import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ARCHIVE, CURRENT_EVENT, EVENT_2025, archiveConfig } from '../config/event'
import { parseScoreList } from './eos-schema'
import { deriveLines, eventDates, lineKeyFor, sessionKey } from './schedule'
import type { ArcherRow } from './types'

function loadRows(): ArcherRow[] {
  const text = readFileSync(
    new URL('../test/fixtures/aggie-2025-score-list.json', import.meta.url),
    'utf8',
  )
  const parsed: { data: unknown } = JSON.parse(text)
  return parseScoreList(parsed.data).rows
}

describe('sessionKey', () => {
  it('trims the venue prefix and trailing space', () => {
    expect(sessionKey('College Station, 11-08-2025 01:00 PM ')).toBe('11-08-2025 01:00 PM')
  })

  it('takes the text after the last comma when the venue has commas', () => {
    expect(
      sessionKey('Scheels Sports Park, 3751 Imagineer Drive, Springfield, IL 62711, 12-14-2025 08:00 AM '),
    ).toBe('12-14-2025 08:00 AM')
  })
})

describe('lineKeyFor', () => {
  it('maps an unrecognised session to other', () => {
    const [first] = loadRows()
    if (!first) throw new Error('fixture has no rows')
    const row: ArcherRow = { ...first, session: 'College Station, 11-08-2025 1:00 PM' }
    expect(lineKeyFor(row, EVENT_2025.lines)).toBe('other')
  })

  it('maps every 2025 fixture row onto a configured line', () => {
    const keys = new Set(EVENT_2025.lines.map((l) => l.key))
    const rows = loadRows()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const key = lineKeyFor(row, EVENT_2025.lines)
      expect(key).not.toBe('other')
      expect(keys.has(key)).toBe(true)
    }
  })
})

describe('deriveLines and eventDates', () => {
  it('derives the five 2025 lines in time order with weekday labels', () => {
    const lines = deriveLines(loadRows())
    expect(lines.map((l) => l.key)).toEqual([
      '11-07-2025 06:00 PM',
      '11-08-2025 08:00 AM',
      '11-08-2025 01:00 PM',
      '11-08-2025 06:00 PM',
      '11-09-2025 09:00 AM',
    ])
    expect(lines.map((l) => l.label)).toEqual([
      'Fri 6:00 PM',
      'Sat 8:00 AM',
      'Sat 1:00 PM',
      'Sat 6:00 PM',
      'Sun 9:00 AM',
    ])
  })

  it('formats the event date range', () => {
    expect(eventDates(loadRows())).toBe('Nov 7–9, 2025')
  })
})

describe('event config', () => {
  it('has a tournament id for the current event', () => {
    expect(CURRENT_EVENT.tournamentId).not.toBe('')
  })

  it('builds archive configs with no lines, and null for unknown years', () => {
    expect(archiveConfig(2024)).toMatchObject({ live: false, lines: [], dates: 'Nov 22–24, 2024' })
    expect(archiveConfig(2019)).toBeNull()
    expect(ARCHIVE.map((a) => a.year)).toEqual([2025, 2024, 2023])
  })
})
