'use client'

import { useCallback, useRef, useState } from 'react'
import type { CardView } from '../components/scorecard-modal'
import { EosHttpError, fetchScorecard } from '@/lib/eos'
import { loadFrozenCard } from '@/lib/frozen'
import { SCORECARD_TTL_MS, cardKey, sessionCards } from '@/lib/scorecard-cache'
import type { ArcherRow, EventConfig, Scorecard } from '@/lib/types'

const LOADING: CardView = { kind: 'loading' }

/** Live years ask EOS; finished ones read our own saved JSON, which costs EOS nothing. */
function requestCard(config: EventConfig, shooterId: string): Promise<Scorecard | null> {
  return config.live ? fetchScorecard(config.tournamentId, shooterId) : loadFrozenCard(config.slug, shooterId)
}

/** A 429 is EOS saying the shared 60-a-minute budget is spent; anything else is a plain failure. */
function failureView(error: unknown): CardView {
  return { kind: 'error', busy: error instanceof EosHttpError && error.status === 429 }
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return new Set([...set].filter((item) => item !== id))
}

export interface ScorecardControl {
  /** The archer whose scorecard is open, or null. */
  open: ArcherRow | null
  view: CardView
  /** Archers whose request is still open; their rows must not be tapped again. */
  pending: ReadonlySet<string>
  show: (row: ArcherRow) => void
  close: () => void
  retry: () => void
}

/**
 * Opens one archer's scorecard. A repeat tap is answered from the session cache, a tap on an archer
 * whose request is still open shares that request, and every failure lands in `view`, so no rejection escapes.
 */
export function useScorecard(config: EventConfig): ScorecardControl {
  const [open, setOpen] = useState<ArcherRow | null>(null)
  const [view, setView] = useState<CardView>(LOADING)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  // The archer on screen now: a late answer for someone the visitor has since left must not replace it.
  const showing = useRef<string | null>(null)
  const scope = config.live ? config.tournamentId : config.slug

  const show = useCallback(
    (row: ArcherRow): void => {
      const id = row.shooterId
      const key = cardKey(scope, id)
      showing.current = id
      setOpen(row)
      const cached = sessionCards.peek(key)
      if (cached !== undefined) {
        setView({ kind: 'ready', card: cached })
        return
      }
      setView(LOADING)
      setPending((prev) => new Set(prev).add(id))
      const settle = (next: CardView): void => {
        setPending((prev) => without(prev, id))
        if (showing.current === id) setView(next)
      }
      sessionCards
        .load(key, () => requestCard(config, id), config.live ? SCORECARD_TTL_MS : undefined)
        .then((card) => settle({ kind: 'ready', card }), (error: unknown) => settle(failureView(error)))
    },
    [config, scope],
  )

  const close = useCallback((): void => {
    showing.current = null
    setOpen(null)
  }, [])

  const retry = useCallback((): void => {
    if (open) show(open)
  }, [open, show])

  return { open, view, pending, show, close, retry }
}
