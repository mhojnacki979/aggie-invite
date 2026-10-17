'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchScoreList } from './eos'
import { INITIAL_FETCH_STATE, nextFetchState } from './fetch-state'
import type { FetchOutcome, FetchState } from './fetch-state'
import { loadFrozen } from './frozen'
import type { EventConfig } from './types'

export const POLL_MS = 20_000
/** Once every line is final the board only needs to catch a late correction. */
export const IDLE_POLL_MS = 300_000

type Apply = (outcome: FetchOutcome) => void

/** How long to wait between EOS fetches; slow once the event has finished. */
export function pollInterval(idle: boolean): number {
  return idle ? IDLE_POLL_MS : POLL_MS
}

/** A live event with no EOS tournament id yet: there is nothing to fetch. */
export function isUnconfigured(config: Pick<EventConfig, 'live' | 'tournamentId'>): boolean {
  return config.live && config.tournamentId === ''
}

/** One EOS fetch. Failures become `{ ok: false }` so the last good scores stay up. */
async function pollOnce(tournamentId: string): Promise<FetchOutcome> {
  try {
    const { rows } = await fetchScoreList(tournamentId)
    return { ok: true, rows, at: Date.now() }
  } catch {
    return { ok: false }
  }
}

/** Fetch every `intervalMs`, and now when `fetchNow`; skip while the tab is hidden; refetch when it returns after a full interval. */
function startPolling(tournamentId: string, apply: Apply, intervalMs: number, fetchNow: boolean): () => void {
  let cancelled = false
  let inFlight = false
  // A restart without a fetch (idle changed) follows a fetch that just happened.
  let lastFetch = fetchNow ? 0 : Date.now()
  const tick = (): void => {
    // One request at a time per visitor, so a slow poll can't pile up or land out of order.
    if (inFlight || document.hidden) return
    inFlight = true
    lastFetch = Date.now()
    void pollOnce(tournamentId).then((outcome) => {
      inFlight = false
      if (!cancelled) apply(outcome)
    })
  }
  // Coming back to the tab refetches only if a full interval has passed, so flicking between apps
  // on a finished event does not spend calls from the budget shared across all of EOS.
  const onVisible = (): void => {
    if (!document.hidden && Date.now() - lastFetch >= intervalMs) tick()
  }
  if (fetchNow) tick()
  const timer = setInterval(tick, intervalMs)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    cancelled = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/** A finished event: load its saved snapshot once. */
function loadSnapshot(slug: string, apply: Apply): () => void {
  let cancelled = false
  loadFrozen(slug)
    .then((frozen): FetchOutcome => ({ ok: true, rows: frozen.rows, at: Date.parse(frozen.frozenAt) }))
    .catch((): FetchOutcome => ({ ok: false }))
    .then((outcome) => {
      if (!cancelled) apply(outcome)
    })
  return () => {
    cancelled = true
  }
}

/**
 * The leaderboard rows for one event: polled from EOS while it is live, read
 * from its frozen snapshot once it is not, and never fetched at all while a
 * live event has no tournament id. `idle` slows the polling to IDLE_POLL_MS.
 * Effects never run during the static build, so the browser APIs above are only
 * touched in the visitor's browser.
 */
export function useEventData(config: EventConfig, idle: boolean = false): FetchState {
  const [state, setState] = useState<FetchState>(INITIAL_FETCH_STATE)
  const loaded = useRef(false)
  const { live, slug, tournamentId } = config

  const apply = useCallback<Apply>((outcome) => {
    if (outcome.ok) loaded.current = true
    setState((prev) => nextFetchState(prev, outcome))
  }, [])

  // A different event starts from nothing; never show the last one's scores.
  useEffect(() => {
    loaded.current = false
    setState(INITIAL_FETCH_STATE)
  }, [live, slug, tournamentId])

  // Not keyed on `idle`: a finished event's snapshot is fetched once, not again when the lines close.
  useEffect(() => (live ? undefined : loadSnapshot(slug, apply)), [live, slug, apply])

  // Changing `idle` restarts the timer but only fetches at once if nothing has loaded yet.
  useEffect(() => {
    if (!live || tournamentId === '') return undefined
    return startPolling(tournamentId, apply, pollInterval(idle), !loaded.current)
  }, [live, tournamentId, idle, apply])

  return state
}
