/**
 * Where bale checkmarks are kept. The check-in page only talks to this interface: Supabase backs it for
 * the 2026 Aggie Invitational, a memory store backs the tests, and the new EOS adds one on its own API.
 */

export interface BaleCheck {
  lineKey: string
  bale: number
  /** ISO timestamp. */
  checkedAt: string
  checkedBy: string
}

export interface CheckStore {
  list(tournamentId: string): Promise<BaleCheck[]>
  /** Idempotent: a bale already checked stays checked, with no error (two tablets can tap at once). */
  check(tournamentId: string, lineKey: string, bale: number): Promise<void>
  uncheck(tournamentId: string, lineKey: string, bale: number): Promise<void>
  /** Calls `onChange` whenever another check or undo lands; returns the unsubscribe. */
  subscribe(tournamentId: string, onChange: () => void): () => void
}

/** Every check is made under the shared crew login (Michael, 2026-11-07). */
export const CREW = 'crew'

function keyOf(tournamentId: string, lineKey: string, bale: number): string {
  return JSON.stringify([tournamentId, lineKey, bale])
}

/** An in-memory store for tests. */
export function createMemoryStore(): CheckStore {
  const checks = new Map<string, BaleCheck & { tournamentId: string }>()
  const listeners = new Map<string, Set<() => void>>()
  const notify = (tournamentId: string): void => listeners.get(tournamentId)?.forEach((listener) => listener())
  return {
    async list(tournamentId) {
      return [...checks.values()]
        .filter((check) => check.tournamentId === tournamentId)
        .map(({ lineKey, bale, checkedAt, checkedBy }) => ({ lineKey, bale, checkedAt, checkedBy }))
    },
    async check(tournamentId, lineKey, bale) {
      const key = keyOf(tournamentId, lineKey, bale)
      if (checks.has(key)) return
      checks.set(key, { tournamentId, lineKey, bale, checkedAt: new Date().toISOString(), checkedBy: CREW })
      notify(tournamentId)
    },
    async uncheck(tournamentId, lineKey, bale) {
      if (checks.delete(keyOf(tournamentId, lineKey, bale))) notify(tournamentId)
    },
    subscribe(tournamentId, onChange) {
      const set = listeners.get(tournamentId) ?? new Set<() => void>()
      set.add(onChange)
      listeners.set(tournamentId, set)
      return () => set.delete(onChange)
    },
  }
}
