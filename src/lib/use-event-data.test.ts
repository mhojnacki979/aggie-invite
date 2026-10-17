import { describe, expect, it } from 'vitest'
import { IDLE_POLL_MS, POLL_MS, isUnconfigured, pollInterval } from './use-event-data'

describe('pollInterval', () => {
  it('polls every 20 seconds while the event is running', () => {
    expect(pollInterval(false)).toBe(POLL_MS)
    expect(POLL_MS).toBe(20_000)
  })

  it('backs off to five minutes once every line is final', () => {
    expect(pollInterval(true)).toBe(IDLE_POLL_MS)
    expect(IDLE_POLL_MS).toBe(300_000)
  })
})

describe('isUnconfigured', () => {
  it('is true only for a live event with an empty tournament id', () => {
    expect(isUnconfigured({ live: true, tournamentId: '' })).toBe(true)
    expect(isUnconfigured({ live: true, tournamentId: 'abc' })).toBe(false)
    expect(isUnconfigured({ live: false, tournamentId: '' })).toBe(false)
    expect(isUnconfigured({ live: false, tournamentId: 'abc' })).toBe(false)
  })
})
