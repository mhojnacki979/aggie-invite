import { describe, expect, it } from 'vitest'
import { archerMeta, roundCountOf, roundHeadings } from './board-columns'
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
