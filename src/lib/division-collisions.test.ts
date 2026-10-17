import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CURRENT_EVENT, YEARS, archiveConfigs } from '../config/event'
import type { FrozenEvent } from './frozen'
import { buildEventView } from './status'
import type { EventView } from './status'
import type { ArcherRow } from './types'

/** The real saved results, so these tests see the typos EOS actually holds. */
function viewOf(slug: string): EventView {
  const text = readFileSync(new URL(`../../public/data/${slug}.json`, import.meta.url), 'utf8')
  const frozen: FrozenEvent = JSON.parse(text)
  const config = archiveConfigs(frozen.year).find((item) => item.slug === slug)
  if (!config) throw new Error(`no archive config for ${slug}`)
  return buildEventView(frozen.rows, config)
}

function slugsOf(view: EventView): string[] {
  return view.divisions.map((division) => division.display.slug)
}

describe('divisions whose raw names parse to the same slug', () => {
  const view = viewOf('2023')
  const bowman = view.divisions.find((d) => d.name === 'Barebow (Recurve) U13 Bowman Female')
  const recurve = view.divisions.find((d) => d.name === 'Barebow (Recurve) U13 Recurve Female')

  it('keeps every 2023 slug unique', () => {
    expect(new Set(slugsOf(view)).size).toBe(view.divisions.length)
  })

  it('gives the larger Barebow U13 board the clean label and slug', () => {
    expect(bowman?.shot).toBe(7)
    expect(bowman?.display.slug).toBe('barebow-u13-women')
    expect(bowman?.display.label).toBe('Barebow U13 Women')
  })

  it('shows the other one under its raw EOS name and its own slug', () => {
    expect(recurve?.shot).toBe(1)
    expect(recurve?.display.label).toBe('Barebow (Recurve) U13 Recurve Female')
    expect(recurve?.display.slug).not.toBe('barebow-u13-women')
    const boards = view.divisions.filter((d) => d.display.slug === recurve?.display.slug)
    expect(boards).toEqual([recurve])
  })

  it('makes Amelia White reachable: her own slug opens her own board, not the Bowman one', () => {
    const boards = view.divisions.filter((d) => d.rows.some((row) => row.name === 'Amelia White'))
    expect(boards).toHaveLength(1)
    expect(boards[0]).toBe(recurve)
    expect(boards[0]?.rows.find((row) => row.name === 'Amelia White')?.total).toBe(199)
    // Resolve the slug the way the division board does: the first division carrying it.
    const opened = view.divisions.find((d) => d.display.slug === recurve?.display.slug)
    expect(opened).toBe(recurve)
    expect(opened?.rows.some((row) => row.name === 'Amelia White')).toBe(true)
    expect(bowman?.rows.some((row) => row.name === 'Amelia White')).toBe(false)
  })

  it('leaves a division nobody shot in uncarded: shot stays 0 for the Senior Senior typo', () => {
    const typo = view.divisions.find((d) => d.name === 'Recurve Senior Senior Female')
    const main = view.divisions.find((d) => d.name === 'Recurve Senior Female')
    expect(typo?.shot).toBe(0)
    expect(main?.display.slug).toBe('recurve-senior-women')
    expect(typo?.display.slug).not.toBe('recurve-senior-women')
  })

  it('is stable: the same data gives the same slugs every time', () => {
    expect(slugsOf(viewOf('2023'))).toEqual(slugsOf(view))
  })
})

describe('years where nothing collides', () => {
  const slugs = YEARS.flatMap((entry) => entry.tournaments.map((t) => t.slug)).filter((slug) => slug !== '2023')

  it.each(slugs)('%s has one clean slug per division and no raw labels', (slug) => {
    const view = viewOf(slug)
    expect(new Set(slugsOf(view)).size).toBe(view.divisions.length)
    expect(view.divisions.every((d) => d.display.label === `${d.display.bow} ${d.display.age} ${d.display.gender ?? ''}`.replace(/ +/g, ' ').trim())).toBe(true)
  })
})

function archer(id: string, division: string, arrowsShot: number): ArcherRow {
  return {
    shooterId: id, name: id, division, rank: 1, rounds: [arrowsShot], total: arrowsShot, tens: 0, nines: 0,
    target: '1A', session: '', arrowsShot, arrowsDue: 60, avg: '0',
  }
}

describe('which colliding division keeps the clean slug', () => {
  const CLEAN = 'Barebow (Recurve) U13 Bowman Female'
  const TYPO = 'Barebow (Recurve) U13 Recurve Female'
  const config = archiveConfigs(2023)[0]!
  const owner = (rows: ArcherRow[]): string | undefined =>
    buildEventView(rows, config).divisions.find((d) => d.display.slug === 'barebow-u13-women')?.name

  it('does not move as arrows land: the typo with more archers shooting never takes the clean slug', () => {
    expect(owner([archer('a', CLEAN, 3), archer('b', TYPO, 30), archer('c', TYPO, 30)])).toBe(CLEAN)
    expect(owner([archer('a', CLEAN, 30), archer('b', TYPO, 3)])).toBe(CLEAN)
    expect(owner([archer('a', CLEAN, 0), archer('b', TYPO, 60), archer('c', TYPO, 60)])).toBe(CLEAN)
  })

  it('breaks an equal-spelling tie by raw name, whatever the order or the scores', () => {
    const first = 'Compound Senior Male'
    const second = 'compound senior male '
    // Both parse to Compound Senior Men with no stray words; the lower raw name wins.
    const lower = first < second ? first : second
    const upper = first < second ? second : first
    const crowded = [archer('a', upper, 50), archer('b', upper, 50), archer('c', lower, 1)]
    const ownerOf = (rows: ArcherRow[]): string | undefined =>
      buildEventView(rows, config).divisions.find((d) => d.display.slug === 'compound-senior-men')?.name
    expect(ownerOf(crowded)).toBe(lower)
    expect(ownerOf([...crowded].reverse())).toBe(lower)
  })
})

describe('the current event', () => {
  it('is not marked finished, so its lines are derived from the data and ?preview= still works', () => {
    expect(CURRENT_EVENT.finished).toBeUndefined()
  })
})
