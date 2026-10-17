import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EVENT_2025 } from '../config/event'
import { parseScoreList } from './eos-schema'
import { searchArchers } from './search'
import { buildEventView } from './status'
import type { EventView } from './status'

function loadView(): EventView {
  const text = readFileSync(
    new URL('../test/fixtures/aggie-2025-score-list.json', import.meta.url),
    'utf8',
  )
  const parsed: { data: unknown } = JSON.parse(text)
  return buildEventView(parseScoreList(parsed.data).rows, EVENT_2025)
}

const view = loadView()

describe('searchArchers', () => {
  it('finds one archer by surname with division, line, target and place', () => {
    const hits = searchArchers(view, 'crotty')
    expect(hits).toHaveLength(1)
    const [hit] = hits
    expect(hit?.row.name).toBe('Chase Crotty')
    expect(hit?.division.display.label).toBe('Compound U18 Men')
    expect(hit?.line?.label).toBe('Sat 8:00 AM')
    expect(hit?.row.target).toBe('11D')
    expect(hit?.place).toBe(3)
  })

  it('ignores apostrophes in both the query and the name', () => {
    for (const query of ["d'amour", 'damour', 'd’amour']) {
      const hits = searchArchers(view, query)
      expect(hits).toHaveLength(1)
      expect(hits[0]?.row.name).toBe("Nicholas D'Amour")
      expect(hits[0]?.place).toBe(1)
      expect(hits[0]?.line?.tag).toBe('JOAD line')
    }
  })

  it('matches words through commas and suffixes', () => {
    const hits = searchArchers(view, 'jordan jr')
    expect(hits.map((h) => h.row.name)).toEqual(['Finis Jordan, Jr'])
  })

  it('returns nothing for a single character or a query that matches no one', () => {
    expect(searchArchers(view, 'c')).toEqual([])
    expect(searchArchers(view, ' c ')).toEqual([])
    expect(searchArchers(view, 'zzzz')).toEqual([])
  })

  it('caps the number of hits at the limit', () => {
    expect(searchArchers(view, 'an', 5)).toHaveLength(5)
  })
})
