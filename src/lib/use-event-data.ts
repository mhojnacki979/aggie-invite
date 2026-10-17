'use client'

import { useEffect, useState } from 'react'
import { fetchScoreList } from './eos'
import { INITIAL_FETCH_STATE, nextFetchState } from './fetch-state'
import type { FetchOutcome, FetchState } from './fetch-state'
import { loadFrozen } from './frozen'
import type { EventConfig } from './types'

export const POLL_MS = 20_000

type Apply = (outcome: FetchOutcome) => void

/** One EOS fetch. Failures become `{ ok: false }` so the last good scores stay up. */
async function pollOnce(tournamentId: string): Promise<FetchOutcome> {
  try {
    const { rows } = await fetchScoreList(tournamentId)
    return { ok: true, rows, at: Date.now() }
  } catch {
    return { ok: false }
  }
}

/** Fetch now, then every POLL_MS; skip while the tab is hidden; refetch when it returns. */
function startPolling(tournamentId: string, apply: Apply): () => void {
  let cancelled = false
  let inFlight = false
  const tick = (): void => {
    // One request at a time per visitor, so a slow poll can't pile up or land out of order.
    if (inFlight || document.hidden) return
    inFlight = true
    void pollOnce(tournamentId).then((outcome) => {
      inFlight = false
      if (!cancelled) apply(outcome)
    })
  }
  const onVisible = (): void => {
    if (!document.hidden) tick()
  }
  tick()
  const timer = setInterval(tick, POLL_MS)
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
 * from its frozen snapshot once it is not. Effects never run during the static
 * build, so the browser APIs above are only touched in the visitor's browser.
 */
export function useEventData(config: EventConfig): FetchState {
  const [state, setState] = useState<FetchState>(INITIAL_FETCH_STATE)
  const { live, slug, tournamentId } = config

  useEffect(() => {
    const apply: Apply = (outcome) => setState((prev) => nextFetchState(prev, outcome))
    // A different event starts from nothing; never show the last one's scores.
    setState(INITIAL_FETCH_STATE)
    return live ? startPolling(tournamentId, apply) : loadSnapshot(slug, apply)
  }, [live, slug, tournamentId])

  return state
}
