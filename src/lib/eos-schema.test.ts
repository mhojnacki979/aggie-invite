import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseScoreList, parseScorecard } from './eos-schema'

function loadFixture(name: string): unknown {
  const text = readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8')
  const parsed: { data: unknown } = JSON.parse(text)
  return parsed.data
}

const scoreList = loadFixture('aggie-2025-score-list.json')
const scorecard = loadFixture('aggie-2025-scorecard-damour.json')

function rawDamourRow(): Record<string, unknown> {
  const data = scoreList as { sortingResult: Record<string, Record<string, Record<string, unknown>>> }
  const group = data.sortingResult['Recurve Senior Male']
  const row = Object.values(group ?? {}).find((r) => r.name === "Nicholas D'Amour")
  if (!row) throw new Error('fixture is missing D\'Amour')
  return row
}

describe('parseScoreList', () => {
  it('parses all 2025 archers', () => {
    const { rows, skipped } = parseScoreList(scoreList)
    expect(rows.length).toBe(512)
    expect(skipped).toBe(0)
    expect(new Set(rows.map((r) => r.division)).size).toBe(49)
  })

  it("maps D'Amour's row", () => {
    const { rows } = parseScoreList(scoreList)
    const row = rows.find((r) => r.name === "Nicholas D'Amour")
    expect(row).toMatchObject({
      division: 'Recurve Senior Male',
      rank: 1,
      half1: 292,
      half2: 295,
      total: 587,
      tens: 47,
      nines: 13,
      target: '23B',
      session: 'College Station, 11-08-2025 01:00 PM ',
      arrowsShot: 60,
      arrowsDue: 60,
      avg: '9.78',
    })
    expect(typeof row?.shooterId).toBe('string')
    expect(row?.shooterId.length).toBeGreaterThan(0)
  })

  it('drops metadata keys', () => {
    const data = { sortingResult: { G: { max_round_count: 2, '0': rawDamourRow() } } }
    expect(parseScoreList(data).rows.length).toBe(1)
  })

  it('skips a bad row', () => {
    const bad = { ...rawDamourRow(), total_score: 'abc' }
    const data = { sortingResult: { G: { max_round_count: 2, '0': bad } } }
    expect(parseScoreList(data)).toEqual({ rows: [], skipped: 1 })
  })
})

describe('parseScorecard', () => {
  it("parses D'Amour's scorecard", () => {
    const card = parseScorecard(scorecard)
    expect(card.ends.length).toBe(20)
    expect(card.ends[0]).toEqual({ arrows: ['10', '10', '9'], score: 29, running: 29 })
    expect(card.ends[9]?.running).toBe(292)
    expect(card.ends[19]?.running).toBe(587)
    expect(card.total).toBe(587)
    expect(card.target).toBe('23B')
  })
})
