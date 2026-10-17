import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EVENT_2025 } from '../config/event'
import { awardsOrder, podiumSlots, stepIndex } from './awards'
import { parseScoreList } from './eos-schema'
import { buildEventView } from './status'
import type { DivisionView, EventView } from './status'
import type { ArcherRow } from './types'

function loadView(): EventView {
  const text = readFileSync(new URL('../test/fixtures/aggie-2025-score-list.json', import.meta.url), 'utf8')
  const parsed: { data: unknown } = JSON.parse(text)
  return buildEventView(parseScoreList(parsed.data).rows, EVENT_2025)
}

const view = loadView()

function division(label: string): DivisionView {
  const found = view.divisions.find((d) => d.display.label === label)
  if (!found) throw new Error(`no division ${label}`)
  return found
}

function names(rows: ArcherRow[]): string[] {
  return rows.map((row) => row.name)
}

describe('stepIndex', () => {
  it('clamps at the first slide', () => {
    expect(stepIndex(0, 49, 'ArrowLeft')).toBe(0)
    expect(stepIndex(0, 49, 'PageUp')).toBe(0)
  })

  it('clamps at the last slide', () => {
    expect(stepIndex(48, 49, 'ArrowRight')).toBe(48)
    expect(stepIndex(48, 49, ' ')).toBe(48)
    expect(stepIndex(48, 49, 'PageDown')).toBe(48)
  })

  it('steps forward and back', () => {
    expect(stepIndex(3, 49, ' ')).toBe(4)
    expect(stepIndex(3, 49, 'ArrowRight')).toBe(4)
    expect(stepIndex(3, 49, 'PageDown')).toBe(4)
    expect(stepIndex(3, 49, 'ArrowLeft')).toBe(2)
    expect(stepIndex(3, 49, 'PageUp')).toBe(2)
  })

  it('jumps home', () => {
    expect(stepIndex(7, 49, 'Home')).toBe(0)
  })

  it('ignores other keys', () => {
    expect(stepIndex(7, 49, 'a')).toBe(7)
    expect(stepIndex(7, 49, 'Enter')).toBe(7)
  })
})

describe('awardsOrder', () => {
  const order = awardsOrder(view)

  it('drops the division nobody shot in', () => {
    expect(view.divisions).toHaveLength(49)
    expect(order).toHaveLength(48)
    expect(order.some((d) => d.shot === 0)).toBe(false)
  })

  it('opens on the first division in the standard ordering', () => {
    expect(order[0]?.display.label).toBe('Recurve U13 Women')
  })
})

describe('podiumSlots', () => {
  it('lays out a clean podium', () => {
    const slots = podiumSlots(division('Compound Senior Women'))
    expect(slots.map((s) => s.kind)).toEqual(['settled', 'settled', 'settled'])
    expect(slots.map((s) => s.place)).toEqual([1, 2, 3])
    expect(slots.map((s) => s.archers[0]?.total)).toEqual([595, 583, 576])
    expect(slots.map((s) => s.archers[0]?.name.split(' ').pop())).toEqual(['Brooks', 'Krahe', 'Moore'])
  })

  it('holds a tie for 1st as a shoot-off and covers the place it takes', () => {
    const slots = podiumSlots(division('Compound U18 Men'))
    expect(slots.map((s) => s.kind)).toEqual(['tie', 'covered', 'settled'])
    expect(names(slots[0]?.archers ?? []).sort()).toEqual(['Brody Wonch', 'Caleb Quiocho'])
    expect(slots[1]?.archers).toEqual([])
    expect(slots[2]?.archers[0]?.name).toBe('Chase Crotty')
  })

  it('settles 1st and holds a tie for 2nd', () => {
    const slots = podiumSlots(division('Compound Senior Men'))
    expect(slots.map((s) => s.kind)).toEqual(['settled', 'tie', 'covered'])
    expect(slots[0]?.archers[0]?.name).toBe('Sawyer Sullivan')
    expect(names(slots[1]?.archers ?? []).sort()).toEqual(['Logan Hamilton', 'Ryan Booth'])
  })

  it('leaves places empty when fewer than three archers shot', () => {
    const slots = podiumSlots(division('Recurve 50+ Men'))
    expect(slots.map((s) => s.kind)).toEqual(['settled', 'settled', 'empty'])
  })
})
