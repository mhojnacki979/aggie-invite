'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BaleCheck, CheckStore } from '@/lib/checkin-store'

const SAVE_ERROR = "Couldn't save. Check the connection and try again."
const LOAD_ERROR = "Couldn't load checkmarks. Retrying…"

export interface BaleChecks {
  checked: (lineKey: string, bale: number) => BaleCheck | undefined
  check: (lineKey: string, bale: number) => Promise<void>
  uncheck: (lineKey: string, bale: number) => Promise<void>
  error: string | null
}

function keyOf(lineKey: string, bale: number): string {
  return `${lineKey}|${bale}`
}

/**
 * The tournament's bale checkmarks, kept current: refetched on every change another tablet makes, when
 * the tab comes back into view, and when the connection returns, so a sleeping tablet is never stale.
 */
export function useBaleChecks(store: CheckStore, tournamentId: string, enabled: boolean): BaleChecks {
  const [checks, setChecks] = useState<BaleCheck[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setChecks(await store.list(tournamentId))
      setError(null)
    } catch {
      setError(LOAD_ERROR)
    }
  }, [store, tournamentId])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const unsubscribe = store.subscribe(tournamentId, () => void refresh())
    const onVisible = (): void => {
      if (!document.hidden) void refresh()
    }
    const onOnline = (): void => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, refresh, store, tournamentId])

  const byKey = useMemo(() => new Map(checks.map((check) => [keyOf(check.lineKey, check.bale), check])), [checks])

  const save = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      try {
        await action()
        setError(null)
      } catch {
        setError(SAVE_ERROR)
      }
      await refresh()
    },
    [refresh],
  )

  return {
    checked: (lineKey, bale) => byKey.get(keyOf(lineKey, bale)),
    check: (lineKey, bale) => save(() => store.check(tournamentId, lineKey, bale)),
    uncheck: (lineKey, bale) => save(() => store.uncheck(tournamentId, lineKey, bale)),
    error,
  }
}
