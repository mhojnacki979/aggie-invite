import { describe, expect, it } from 'vitest'
import { archerMeta, arrowAverage, formatAverage, roundCountOf, roundHeadings, roundScore, sortRows } from './board-columns'
import type { LineView } from './status'
import type { ArcherRow } from './types'

function row(overrides: Partial<ArcherRow>): ArcherRow {
  return {
    shooterId: 'x',
    name: 'Test Archer',
    division: 'Recurve Senior Male',
    rank: 1,
    rounds: [290, 295],
    total: 585,
    tens: 40,
    nines: 15,
    target: '23B',
    session: 'College Station, 11-08-2025 01:00 PM ',
    arrowsShot: 60,
    arrowsDue: 60,
    avg: '9.75',
    ...overrides,
  }
}

const joad: LineView = { key: 'k', label: 'Sat 1:00 PM', tag: 'JOAD line', status: 'final', archers: 100, endsShot: 20 }

describe('roundCountOf', () => {
  it('follows the first row with arrows', () => {
    const noShow = row({ arrowsShot: 0, rounds: [0, 0] })
    const doubleFita = row({ rounds: [299, 291, 298, 297] })
    expect(roundCountOf([noShow, doubleFita])).toBe(4)
  })

  it('falls back to two when nobody has shot', () => {
    expect(roundCountOf([row({ arrowsShot: 0, rounds: [] })])).toBe(2)
    expect(roundCountOf([])).toBe(2)
  })
})

describe('roundHeadings', () => {
  it('names two rounds 1st 30 and 2nd 30', () => {
    expect(roundHeadings(2)).toEqual(['1st 30', '2nd 30'])
  })

  it('numbers any other count', () => {
    expect(roundHeadings(4)).toEqual(['R1', 'R2', 'R3', 'R4'])
    expect(roundHeadings(3)).toEqual(['R1', 'R2', 'R3'])
  })
})

describe('archerMeta', () => {
  it('reads line, target and the line tag', () => {
    expect(archerMeta(row({}), joad)).toBe('Sat 1:00 PM · 23B · JOAD line')
  })

  it('leaves out the tag when the line has none', () => {
    const { tag: _tag, ...plain } = joad
    expect(archerMeta(row({}), plain)).toBe('Sat 1:00 PM · 23B')
  })

  it('still shows the target when the archer has no line', () => {
    expect(archerMeta(row({}), undefined)).toBe('23B')
    expect(archerMeta(row({ target: '' }), undefined)).toBe('')
  })
})

describe('roundScore', () => {
  it('reads each round from EOS once the archer has started it', () => {
    expect(roundScore(row({ rounds: [152, 149] }), 0, 2)).toBe(152)
    expect(roundScore(row({ rounds: [152, 149] }), 1, 2)).toBe(149)
  })

  it('is null for a round the archer has not reached, so it reads as a dash, not 0', () => {
    const halfway = row({ rounds: [152, 0], arrowsShot: 30 })
    expect(roundScore(halfway, 1, 2)).toBeNull()
    expect(roundScore(row({ rounds: [152, 27], arrowsShot: 33 }), 1, 2)).toBe(27)
  })

  it('is null when EOS sent no score for that round', () => {
    expect(roundScore(row({ rounds: [152] }), 1, 2)).toBeNull()
  })

  it('trusts EOS when arrows due does not split evenly into rounds', () => {
    expect(roundScore(row({ rounds: [10, 0], arrowsShot: 3, arrowsDue: 0 }), 1, 2)).toBe(0)
  })
})

describe('arrowAverage', () => {
  it('is the total over arrows shot so far', () => {
    expect(arrowAverage(row({ total: 587, arrowsShot: 60 }))).toBeCloseTo(9.7833, 4)
    expect(arrowAverage(row({ total: 147, arrowsShot: 15 }))).toBeCloseTo(9.8, 4)
  })

  it('is null before the first arrow', () => {
    expect(arrowAverage(row({ total: 0, arrowsShot: 0 }))).toBeNull()
  })
})

describe('formatAverage', () => {
  it('shows two decimals, the way EOS does', () => {
    expect(formatAverage(587 / 60)).toBe('9.78')
    expect(formatAverage(10)).toBe('10.00')
  })
})

describe('sortRows', () => {
  const leader = row({ shooterId: 'leader', rank: 1, total: 580, arrowsShot: 60 }) // 9.67
  const midLine = row({ shooterId: 'mid', rank: 2, total: 295, arrowsShot: 30 }) // 9.83
  const steady = row({ shooterId: 'steady', rank: 3, total: 290, arrowsShot: 30 }) // 9.67, same as leader
  const noShow = row({ shooterId: 'none', rank: 4, total: 0, arrowsShot: 0 })
  const board = [leader, midLine, steady, noShow]
  const ids = (rows: ArcherRow[]) => rows.map((r) => r.shooterId)

  it('keeps the official order when sorted by score', () => {
    expect(ids(sortRows(board, 'score'))).toEqual(['leader', 'mid', 'steady', 'none'])
  })

  it('orders by arrow average, a tie keeping the official order, and no-shows last', () => {
    expect(ids(sortRows([noShow, steady, midLine, leader], 'average'))).toEqual(['mid', 'leader', 'steady', 'none'])
  })

  it('compares the exact average, not the two-decimal display', () => {
    const a = row({ shooterId: 'a', rank: 1, total: 586, arrowsShot: 60 }) // 9.7666…
    const b = row({ shooterId: 'b', rank: 2, total: 293, arrowsShot: 30 }) // 9.7666… exactly equal
    const c = row({ shooterId: 'c', rank: 3, total: 577, arrowsShot: 59 }) // 9.7796…, shows 9.78
    expect(ids(sortRows([a, b, c], 'average'))).toEqual(['c', 'a', 'b'])
  })

  it('keeps several no-shows in official order', () => {
    const late = row({ shooterId: 'late', rank: 6, total: 0, arrowsShot: 0 })
    const later = row({ shooterId: 'later', rank: 7, total: 0, arrowsShot: 0 })
    expect(ids(sortRows([later, late, midLine], 'average'))).toEqual(['mid', 'late', 'later'])
  })

  it('leaves the given array alone', () => {
    const copy = [...board]
    sortRows(board, 'average')
    expect(board).toEqual(copy)
  })
})
