import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compareDivisions, parseDivisionName } from './divisions'
import { parseScoreList } from './eos-schema'

function loadFixture(name: string): unknown {
  const text = readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8')
  const parsed: { data: unknown } = JSON.parse(text)
  return parsed.data
}

describe('parseDivisionName', () => {
  it('parses a Barebow division', () => {
    expect(parseDivisionName('BAREBOW (recurve) Senior Female')).toMatchObject({
      bow: 'Barebow',
      age: 'Senior',
      gender: 'Women',
      label: 'Barebow Senior Women',
      slug: 'barebow-senior-women',
      known: true,
    })
  })

  it('renames Fixed Pin and drops Cadet', () => {
    expect(parseDivisionName('Fixed Pin U18 Cadet Male').label).toBe('Fixed Pins U18 Men')
  })

  it('drops Cub', () => {
    expect(parseDivisionName('Compound U15 Cub Male').label).toBe('Compound U15 Men')
  })

  it('reads the 2022 spelling with the class word before the age', () => {
    expect(parseDivisionName('barebow (recurve) bowman u13 female')).toMatchObject({
      label: 'Barebow U13 Women',
      slug: 'barebow-u13-women',
    })
    expect(parseDivisionName('compound trophy cub u15 male').label).toBe('Compound U15 Men')
  })

  it('does not match Fixed Pin inside Fixed Pins', () => {
    expect(parseDivisionName('Fixed Pins U13 Male').label).toBe('Fixed Pins U13 Men')
  })

  it('parses a Para bow', () => {
    expect(parseDivisionName('Para W1 Senior Male').label).toBe('Para W1 Senior Men')
  })

  it('turns + into plus in the slug', () => {
    expect(parseDivisionName('Recurve 50+ Male').slug).toBe('recurve-50plus-men')
  })

  it('displays 50-70+ with an en dash', () => {
    expect(parseDivisionName('Barebow (recurve) 50-70+ Female').label).toBe('Barebow 50–70+ Women')
  })

  it('keeps an unknown bow as-is and sorts it last', () => {
    const unknown = parseDivisionName('Traditional U18 Female')
    expect(unknown.known).toBe(false)
    expect(unknown.label).toBe('Traditional U18 Female')
    expect(compareDivisions(unknown, parseDivisionName('Para Recurve Senior Male'))).toBeGreaterThan(0)
  })
})

describe('compareDivisions', () => {
  it('sorts by bow, then age, then gender', () => {
    const raw = ['Recurve Senior Male', 'Recurve U13 Female', 'Compound U13 Male', 'Recurve U13 Male']
    const sorted = [...raw].sort((a, b) => compareDivisions(parseDivisionName(a), parseDivisionName(b)))
    expect(sorted).toEqual(['Recurve U13 Female', 'Recurve U13 Male', 'Recurve Senior Male', 'Compound U13 Male'])
  })
})

describe('2025 fixture', () => {
  it('parses all 49 divisions as known with unique slugs', () => {
    const { rows } = parseScoreList(loadFixture('aggie-2025-score-list.json'))
    const names = [...new Set(rows.map((r) => r.division))]
    const parsed = names.map(parseDivisionName)
    expect(parsed.length).toBe(49)
    expect(parsed.every((d) => d.known)).toBe(true)
    expect(new Set(parsed.map((d) => d.slug)).size).toBe(49)
  })
})

describe('2022 Double FITA fixture', () => {
  it('parses every division as known', () => {
    const { rows } = parseScoreList(loadFixture('aggie-2022-double-fita-score-list.json'))
    const parsed = [...new Set(rows.map((r) => r.division))].map(parseDivisionName)
    expect(parsed.length).toBe(43)
    expect(parsed.filter((d) => !d.known).map((d) => d.label)).toEqual([])
  })
})
