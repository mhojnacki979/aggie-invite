import type { DivisionView, EventView, LineView } from './status'
import type { ArcherRow } from './types'

export interface ArcherHit {
  row: ArcherRow
  division: DivisionView
  line: LineView | undefined
  /** The archer's rank in the division, after shoot-offs. */
  place: number
}

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 20

/** Lowercase, drop apostrophes, commas and periods, collapse spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matches(name: string, query: string): boolean {
  if (name.includes(query)) return true
  const nameWords = name.split(' ')
  return query.split(' ').every((word) => nameWords.some((w) => w.startsWith(word)))
}

interface Candidate {
  hit: ArcherHit
  name: string
}

function candidates(view: EventView, query: string): Candidate[] {
  const found: Candidate[] = []
  for (const division of view.divisions) {
    for (const row of division.rows) {
      const name = normalize(row.name)
      if (!matches(name, query)) continue
      const line = view.lineByShooter[row.shooterId]
      found.push({ hit: { row, division, line, place: row.rank }, name })
    }
  }
  return found
}

function byExactThenName(query: string) {
  return (a: Candidate, b: Candidate): number => {
    const exactA = a.name === query ? 0 : 1
    const exactB = b.name === query ? 0 : 1
    if (exactA !== exactB) return exactA - exactB
    if (a.name !== b.name) return a.name < b.name ? -1 : 1
    return a.hit.row.shooterId < b.hit.row.shooterId ? -1 : 1
  }
}

/** Find archers by part of their name. Returns nothing for a query under two characters. */
export function searchArchers(
  view: EventView,
  query: string,
  limit: number = DEFAULT_LIMIT,
): ArcherHit[] {
  const normalized = normalize(query)
  if (normalized.length < MIN_QUERY_LENGTH) return []
  return candidates(view, normalized)
    .sort(byExactThenName(normalized))
    .slice(0, limit)
    .map((c) => c.hit)
}
