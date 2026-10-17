import { lineKeyFor } from './schedule'
import type { ArcherRow, LineConfig } from './types'

const PREVIEW_PATTERN = /^\d+-\d+$/
const MAX_END = 20
const ARROWS_PER_END = 3

/** Reads `?preview=<lineIndex>-<end>`; anything else, including an end past 20, is no preview. */
export function parsePreview(param: string | null): { lineIndex: number; end: number } | null {
  if (param === null || !PREVIEW_PATTERN.test(param)) return null
  const [line, end] = param.split('-').map(Number)
  if (line === undefined || end === undefined || end > MAX_END) return null
  return { lineIndex: line, end }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

function zeroed(row: ArcherRow): ArcherRow {
  return { ...row, arrowsShot: 0, total: 0, tens: 0, nines: 0, rounds: row.rounds.map(() => 0) }
}

/**
 * Keeps the share of each round that falls inside the first `shot` arrows. A round is measured
 * against the arrows the archer really shot in it, so a partial round already behind the cut
 * keeps its score and a full round is untouched.
 */
function scaledRounds(row: ArcherRow, shot: number): number[] {
  const per = row.rounds.length > 0 ? row.arrowsDue / row.rounds.length : 0
  if (per <= 0) return row.rounds.map(() => 0)
  return row.rounds.map((score, i) => {
    const existing = clamp(row.arrowsShot - i * per, 0, per)
    if (existing === 0) return 0
    return Math.round((score * clamp(shot - i * per, 0, per)) / existing)
  })
}

function cutLine(row: ArcherRow, end: number): ArcherRow {
  const shot = Math.min(row.arrowsShot, end * ARROWS_PER_END)
  if (row.arrowsShot === 0) return zeroed(row)
  const rounds = scaledRounds(row, shot)
  const ratio = shot / row.arrowsShot
  return {
    ...row,
    arrowsShot: shot,
    rounds,
    total: rounds.reduce((sum, score) => sum + score, 0),
    tens: Math.round(row.tens * ratio),
    nines: Math.round(row.nines * ratio),
  }
}

function rerank(rows: ArcherRow[]): ArcherRow[] {
  const byDivision = new Map<string, ArcherRow[]>()
  for (const row of rows) byDivision.set(row.division, [...(byDivision.get(row.division) ?? []), row])
  const rankOf = new Map<ArcherRow, number>()
  for (const group of byDivision.values()) {
    const ordered = [...group].sort((a, b) => b.total - a.total || b.tens - a.tens || b.nines - a.nines)
    ordered.forEach((row, i) => {
      const prev = ordered[i - 1]
      const tied = prev && prev.total === row.total && prev.tens === row.tens && prev.nines === row.nines
      rankOf.set(row, tied ? (rankOf.get(prev) ?? i + 1) : i + 1)
    })
  }
  return rows.map((row) => ({ ...row, rank: rankOf.get(row) ?? row.rank }))
}

/**
 * Simulates the tournament at one moment: lines before `lineIndex` are done, that line has shot
 * `end` ends, and everything later (or unmatched) has not started. For preview and tests only.
 */
export function cutAt(rows: ArcherRow[], lines: LineConfig[], lineIndex: number, end: number): ArcherRow[] {
  const cut = rows.map((row) => {
    const index = lines.findIndex((line) => line.key === lineKeyFor(row, lines))
    if (index < 0 || index > lineIndex) return zeroed(row)
    return index < lineIndex ? row : cutLine(row, end)
  })
  return rerank(cut)
}
