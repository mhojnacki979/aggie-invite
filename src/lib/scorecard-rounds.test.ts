import { describe, expect, it } from 'vitest'
import { roundGroups } from './scorecard-rounds'
import type { EndScore } from './types'

/** `count` three-arrow ends of `score` points each, with the running total filled in. */
function ends(count: number, score = 27, arrowsPerEnd = 3): EndScore[] {
  return Array.from({ length: count }, (_, index) => ({
    arrows: Array.from({ length: arrowsPerEnd }, () => '9'),
    score,
    running: score * (index + 1),
  }))
}

describe('roundGroups', () => {
  it('splits a 60-arrow card after end 10 and totals each round', () => {
    const groups = roundGroups(ends(20), 60, 2)
    expect(groups.map((g) => g.heading)).toEqual(['1st 30', '2nd 30'])
    expect(groups.map((g) => g.subtotal)).toEqual([270, 270])
    expect(groups[0]?.ends).toHaveLength(10)
    expect(groups[1]?.firstEnd).toBe(11)
  })

  it('totals a round still being shot from the ends it has so far', () => {
    const groups = roundGroups(ends(13), 60, 2)
    expect(groups.map((g) => g.subtotal)).toEqual([270, 81])
    expect(groups[1]?.ends).toHaveLength(3)
  })

  it('leaves out a round with no ends yet', () => {
    const groups = roundGroups(ends(7), 60, 2)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.subtotal).toBe(189)
  })

  it('follows the end size, so six-arrow Double FITA ends make four rounds of six', () => {
    const groups = roundGroups(ends(24, 54, 6), 144, 4)
    expect(groups.map((g) => g.heading)).toEqual(['R1', 'R2', 'R3', 'R4'])
    expect(groups.map((g) => g.ends.length)).toEqual([6, 6, 6, 6])
  })

  it('falls back to one untitled group when the rounds do not divide evenly into ends', () => {
    const groups = roundGroups(ends(20), 61, 2)
    expect(groups).toEqual([{ heading: null, firstEnd: 1, ends: ends(20), subtotal: 540 }])
  })

  it('falls back to one untitled group when arrows due is unknown', () => {
    expect(roundGroups(ends(4), 0, 2)[0]?.heading).toBeNull()
  })

  it('returns nothing for a card with no ends', () => {
    expect(roundGroups([], 60, 2)).toEqual([])
  })
})
