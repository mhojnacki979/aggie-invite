import { describe, expect, it } from 'vitest'
import { INITIAL_FETCH_STATE, nextFetchState } from './fetch-state'
import type { ArcherRow } from './types'

function row(shooterId: string, total: number): ArcherRow {
  return {
    shooterId,
    name: `Archer ${shooterId}`,
    division: 'Recurve Men',
    rank: 1,
    rounds: [total],
    total,
    tens: 0,
    nines: 0,
    target: '1A',
    session: 'Venue, 11-07-2025 06:00 PM ',
    arrowsShot: 60,
    arrowsDue: 60,
    avg: '9.0',
  }
}

describe('nextFetchState', () => {
  it('takes the rows and time from a good fetch', () => {
    const r = row('a', 540)
    expect(nextFetchState(INITIAL_FETCH_STATE, { ok: true, rows: [r], at: 1000 })).toEqual({
      rows: [r],
      updatedAt: 1000,
      error: false,
    })
  })

  it('keeps the last good scores and flags an error when a fetch fails', () => {
    const r = row('a', 540)
    const good = nextFetchState(INITIAL_FETCH_STATE, { ok: true, rows: [r], at: 1000 })
    const failed = nextFetchState(good, { ok: false })
    expect(failed.rows).toBe(good.rows)
    expect(failed.updatedAt).toBe(1000)
    expect(failed.error).toBe(true)
  })

  it('clears the error on the next good fetch', () => {
    const first = row('a', 540)
    const second = row('b', 555)
    const good = nextFetchState(INITIAL_FETCH_STATE, { ok: true, rows: [first], at: 1000 })
    const failed = nextFetchState(good, { ok: false })
    expect(nextFetchState(failed, { ok: true, rows: [second], at: 2000 })).toEqual({
      rows: [second],
      updatedAt: 2000,
      error: false,
    })
  })
})
