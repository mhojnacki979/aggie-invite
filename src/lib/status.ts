import { compareDivisions, parseDivisionName, slugify, strayWordCount } from './divisions'
import type { DivisionName } from './divisions'
import { OTHER_LINE_KEY, deriveLines, lineKeyFor } from './schedule'
import type { ArcherRow, EventConfig, LineConfig } from './types'

export type LineStatus = 'upcoming' | 'shooting' | 'final'

export interface LineView {
  key: string
  label: string
  tag?: string
  status: LineStatus
  archers: number
  endsShot: number
}

export interface DivisionView {
  name: string
  display: DivisionName
  status: 'provisional' | 'final'
  count: number
  shot: number
  remaining: number
  tieFor: number | null
  rows: ArcherRow[]
  podium: ArcherRow[]
}

export interface EventView {
  lines: LineView[]
  divisions: DivisionView[]
  lineByShooter: Record<string, LineView>
}

const ARROWS_PER_END = 3
const PODIUM_RANKS = 3

/** An archer is done once every arrow due has been shot. */
export function isDone(row: ArcherRow): boolean {
  return row.arrowsDue > 0 && row.arrowsShot >= row.arrowsDue
}

function hasArrow(row: ArcherRow): boolean {
  return row.arrowsShot > 0
}

/** The configured lines (or the ones in the data), plus Other only when some archer lands there. */
function resolveLines(rows: ArcherRow[], config: EventConfig): LineConfig[] {
  const lines = config.lines.length > 0 ? config.lines : deriveLines(rows)
  const hasOther = rows.some((row) => lineKeyFor(row, lines) === OTHER_LINE_KEY)
  return hasOther ? [...lines, { key: OTHER_LINE_KEY, label: 'Other' }] : lines
}

function groupByLine(rows: ArcherRow[], lines: LineConfig[]): Map<string, ArcherRow[]> {
  const groups = new Map<string, ArcherRow[]>(lines.map((line) => [line.key, []]))
  for (const row of rows) groups.get(lineKeyFor(row, lines))?.push(row)
  return groups
}

/**
 * Final once a later line has an arrow, the line is manually closed, or everyone with an arrow is
 * done. Upcoming when nobody has shot. Otherwise shooting. Archers with no arrows are no-shows.
 */
function lineStatus(archers: ArcherRow[], laterStarted: boolean, closed: boolean): LineStatus {
  const started = archers.filter(hasArrow)
  if (laterStarted || closed || (started.length > 0 && started.every(isDone))) return 'final'
  return started.length === 0 ? 'upcoming' : 'shooting'
}

function buildLineViews(rows: ArcherRow[], lines: LineConfig[], config: EventConfig): LineView[] {
  const groups = groupByLine(rows, lines)
  const real = lines.filter((line) => line.key !== OTHER_LINE_KEY)
  return lines.map((line) => {
    const archers = groups.get(line.key) ?? []
    const index = real.indexOf(line)
    const later = index < 0 ? [] : real.slice(index + 1)
    const laterStarted = later.some((next) => (groups.get(next.key) ?? []).some(hasArrow))
    const mostArrows = Math.max(0, ...archers.map((row) => row.arrowsShot))
    const closed = config.closedLines.includes(line.key) || (config.finished === true && mostArrows > 0)
    const view: LineView = {
      key: line.key,
      label: line.label,
      status: lineStatus(archers, laterStarted, closed),
      archers: archers.length,
      endsShot: Math.floor(mostArrows / ARROWS_PER_END),
    }
    return line.tag ? { ...view, tag: line.tag } : view
  })
}

/** Gives the named tied archers ranks r, r+1, ... in the listed order; any miss leaves rows alone. */
function applyShootOff(rows: ArcherRow[], names: string[] | undefined): ArcherRow[] {
  if (!names || names.length === 0) return rows
  const found = names.map((name) => rows.find((row) => row.name === name))
  const named = found.filter((row): row is ArcherRow => row !== undefined)
  const first = named[0]
  if (named.length !== names.length || !first) return rows
  if (new Set(named.map((row) => row.rank)).size !== 1) return rows
  if (new Set(named).size !== named.length) return rows
  // A partial list would leave an unnamed archer tied at a rank another now holds.
  if (named.length !== rows.filter((row) => row.rank === first.rank).length) return rows
  return rows.map((row) => {
    const place = named.indexOf(row)
    return place < 0 ? row : { ...row, rank: first.rank + place }
  })
}

/** Lowest rank within the top three that two or more archers with arrows share. */
function findTie(rows: ArcherRow[]): number | null {
  const counts = new Map<number, number>()
  for (const row of rows.filter(hasArrow)) {
    if (row.rank <= PODIUM_RANKS) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1)
  }
  const tied = [...counts].filter(([, count]) => count > 1).map(([rank]) => rank)
  return tied.length > 0 ? Math.min(...tied) : null
}

function buildDivision(
  name: string,
  group: ArcherRow[],
  lineOf: (row: ArcherRow) => LineView | undefined,
  shootOffs: Record<string, string[]>,
): DivisionView {
  // Array.prototype.sort is stable, so equal EOS ranks keep the order EOS returned.
  const ordered = applyShootOff(group, shootOffs[name]).sort((a, b) => a.rank - b.rank)
  const remaining = ordered.filter((row) => !isDone(row) && lineOf(row)?.status !== 'final').length
  return {
    name,
    display: parseDivisionName(name),
    status: remaining === 0 ? 'final' : 'provisional',
    count: ordered.length,
    shot: ordered.filter(hasArrow).length,
    remaining,
    tieFor: findTie(ordered),
    rows: ordered,
    podium: ordered.filter((row) => row.rank <= PODIUM_RANKS && hasArrow(row)),
  }
}

/** Cleanest raw spelling first: fewest stray words, then the lower raw name. */
function byCleanSpelling(a: DivisionView, b: DivisionView): number {
  const diff = strayWordCount(a.name) - strayWordCount(b.name)
  if (diff !== 0) return diff
  // A plain comparison, not localeCompare, so the order cannot vary with the environment's locale.
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

/**
 * Two raw EOS names can parse to one label and slug (typos in the tournament's own division names).
 * The division whose raw name is the cleanest spelling keeps the clean label and slug (fewest stray
 * words, then the lower raw name); each other one is shown under its raw EOS name and a slug made from it,
 * so every board stays reachable. The choice reads only the names, never the scores: a bookmarked
 * link must keep opening the same board while arrows land. A no-op when nothing collides.
 */
function separateCollisions(divisions: DivisionView[]): DivisionView[] {
  const bySlug = new Map<string, DivisionView[]>()
  for (const division of divisions) {
    bySlug.set(division.display.slug, [...(bySlug.get(division.display.slug) ?? []), division])
  }
  const renamed = new Set<DivisionView>()
  for (const group of bySlug.values()) {
    const ranked = [...group].sort(byCleanSpelling)
    for (const other of ranked.slice(1)) renamed.add(other)
  }
  return divisions.map((division) =>
    renamed.has(division)
      ? { ...division, display: { ...division.display, label: division.name.trim(), slug: slugify(division.name) } }
      : division,
  )
}

function groupByDivision(rows: ArcherRow[]): Map<string, ArcherRow[]> {
  const groups = new Map<string, ArcherRow[]>()
  for (const row of rows) groups.set(row.division, [...(groups.get(row.division) ?? []), row])
  return groups
}

/** Everything the pages show: line states, every division with its podium and ties. */
export function buildEventView(rows: ArcherRow[], config: EventConfig): EventView {
  const lines = resolveLines(rows, config)
  const lineViews = buildLineViews(rows, lines, config)
  const viewByKey = new Map(lineViews.map((view) => [view.key, view]))
  const lineOf = (row: ArcherRow): LineView | undefined => viewByKey.get(lineKeyFor(row, lines))
  const divisions = separateCollisions(
    [...groupByDivision(rows)].map(([name, group]) => buildDivision(name, group, lineOf, config.shootOffs)),
  ).sort((a, b) => compareDivisions(a.display, b.display))
  const lineByShooter: Record<string, LineView> = {}
  for (const row of rows) {
    const view = lineOf(row)
    if (view) lineByShooter[row.shooterId] = view
  }
  return { lines: lineViews, divisions, lineByShooter }
}
