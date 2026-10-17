import type { ArcherRow } from './types'

export interface FetchState {
  /** The last good scores; null until the first good fetch. */
  rows: ArcherRow[] | null
  /** When the last good fetch landed (ms since epoch); null until the first. */
  updatedAt: number | null
  /** True while the latest fetch failed; the rows above are then the last good ones. */
  error: boolean
}

export const INITIAL_FETCH_STATE: FetchState = { rows: null, updatedAt: null, error: false }

export type FetchOutcome = { ok: true; rows: ArcherRow[]; at: number } | { ok: false }

/**
 * A failed fetch never blanks the board: the last good rows and time stay and
 * only `error` flips on. The next good fetch replaces them and clears it.
 */
export function nextFetchState(prev: FetchState, outcome: FetchOutcome): FetchState {
  if (!outcome.ok) return { ...prev, error: true }
  return { rows: outcome.rows, updatedAt: outcome.at, error: false }
}
