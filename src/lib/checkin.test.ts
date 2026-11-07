import { describe, expect, it } from 'vitest'
import { balesForLine, baleStatus, defaultLineKey, lineProgress, parseTarget } from './checkin'
import type { Bale } from './checkin'
import type { DivisionView, EventView, LineView } from './status'
import type { ArcherRow } from './types'

function row(shooterId: string, target: string, arrowsShot = 60): ArcherRow {
  return {
    shooterId,
    name: `Archer ${shooterId}`,
    division: 'Recurve U15 Female',
    rank: 1,
    rounds: [150, 150],
    total: 300,
    tens: 9,
    nines: 10,
    target,
    session: '',
    arrowsShot,
    arrowsDue: 60,
    avg: '',
  }
}

function line(key: string, status: LineView['status'], endsShot: number): LineView {
  return { key, label: key, status, archers: 0, endsShot }
}

const SAT8 = line('sat8', 'shooting', 12)
const FRI6 = line('fri6', 'final', 20)

function eventView(entries: [ArcherRow, LineView][], lines: LineView[] = [FRI6, SAT8]): EventView {
  const rows = entries.map(([r]) => r)
  const division = { name: 'Recurve U15 Female', display: { label: 'Recurve U15 Women' }, rows } as DivisionView
  const lineByShooter = Object.fromEntries(entries.map(([r, l]) => [r.shooterId, l]))
  return { lines, divisions: [division], lineByShooter }
}

describe('parseTarget', () => {
  it('reads the bale number and the position letter', () => {
    expect(parseTarget('14B')).toEqual({ bale: 14, position: 'B' })
    expect(parseTarget('7A')).toEqual({ bale: 7, position: 'A' })
  })

  it('tolerates a space and a lower-case letter', () => {
    expect(parseTarget('14 b')).toEqual({ bale: 14, position: 'B' })
  })

  it('rejects anything that is not a bale number followed by one letter', () => {
    for (const bad of ['', 'B14', '14', '0A', '14BC']) expect(parseTarget(bad)).toBeNull()
  })
})

describe('balesForLine', () => {
  const view = eventView([
    [row('1', '14C'), SAT8],
    [row('2', '3A'), SAT8],
    [row('3', '14A'), SAT8],
    [row('4', ''), SAT8],
    [row('5', '14B'), FRI6],
  ])

  it('groups only that line, bales in number order, seats in letter order, "No bale" last', () => {
    const bales = balesForLine(view, 'sat8')
    expect(bales.map((b) => b.number)).toEqual([3, 14, null])
    expect(bales[1]?.seats.map((s) => [s.row.shooterId, s.position])).toEqual([
      ['3', 'A'],
      ['1', 'C'],
    ])
    expect(bales[2]?.seats.map((s) => s.row.shooterId)).toEqual(['4'])
  })

  it("carries each archer's division", () => {
    expect(balesForLine(view, 'fri6')[0]?.seats[0]?.division.display.label).toBe('Recurve U15 Women')
  })
})

function bale(number: number | null, arrows: number[]): Bale {
  return { number, seats: arrows.map((shot, i) => ({ row: row(String(i), '1A', shot), position: 'A', division: {} as DivisionView })) }
}

describe('baleStatus', () => {
  it('is ready once everyone on the bale has shot every arrow', () => {
    expect(baleStatus(bale(1, [60, 60]), false)).toBe('ready')
  })

  it('is still shooting while anyone has arrows left, a withdrawn archer included', () => {
    expect(baleStatus(bale(1, [60, 33]), false)).toBe('shooting')
  })

  it('is checked whenever a check exists, finished or not', () => {
    expect(baleStatus(bale(1, [60, 33]), true)).toBe('checked')
  })
})

describe('lineProgress', () => {
  it('counts bales by state and leaves "No bale" out', () => {
    const bales = [bale(1, [60]), bale(2, [60]), bale(3, [30]), bale(null, [60])]
    expect(lineProgress(bales, new Set([1]))).toEqual({ total: 3, checked: 1, ready: 1, shooting: 1 })
  })
})

describe('defaultLineKey', () => {
  it('opens on the line that is shooting now', () => {
    expect(defaultLineKey(eventView([], [FRI6, SAT8, line('sat1', 'upcoming', 0)]))).toBe('sat8')
  })

  it('otherwise opens on the last line with arrows', () => {
    expect(defaultLineKey(eventView([], [FRI6, line('sat8', 'final', 20), line('sat1', 'upcoming', 0)]))).toBe('sat8')
  })

  it('falls back to the first line, or null with none', () => {
    expect(defaultLineKey(eventView([], [line('a', 'upcoming', 0)]))).toBe('a')
    expect(defaultLineKey(eventView([], []))).toBeNull()
  })
})
