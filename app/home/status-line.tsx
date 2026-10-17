'use client'

import { useEffect, useState } from 'react'
import type { FetchState } from '@/lib/fetch-state'
import type { EventConfig } from '@/lib/types'

function ago(seconds: number): string {
  return seconds < 120 ? `${seconds}s` : `${Math.floor(seconds / 60)} min`
}

/** Re-renders once a second so "Updated Ns ago" keeps counting between polls. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  return now
}

function statusText(config: EventConfig, state: FetchState, now: number): string {
  if (!config.live) {
    if (state.error) return "Couldn't load these results"
    return state.rows === null ? 'Loading results…' : 'Final results'
  }
  if (state.error) return 'Reconnecting…'
  if (state.updatedAt === null) return 'Loading scores…'
  return `Updated ${ago(Math.max(0, Math.floor((now - state.updatedAt) / 1000)))} ago`
}

/** One quiet line saying how fresh the scores are, or that the event is over. */
export function StatusLine({ config, state }: { config: EventConfig; state: FetchState }) {
  const now = useNow(config.live && state.updatedAt !== null)
  const text = statusText(config, state, now)
  // The seconds tick every second, so that text must not sit in a live region (it would be read
  // out continuously). The region is always present and only gets text for the rare error state.
  return (
    <p className="status-line">
      <span role="status">{state.error ? text : null}</span>
      {!state.error && <span>{text}</span>}
    </p>
  )
}
