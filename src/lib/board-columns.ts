import type { LineView } from './status'
import type { ArcherRow } from './types'

/** Without a first row that has arrows there is nothing to count, so assume the usual two rounds. */
export const DEFAULT_ROUNDS = 2

/** How many round columns this division's own data has. */
export function roundCountOf(rows: ArcherRow[]): number {
  return rows.find((row) => row.arrowsShot > 0)?.rounds.length ?? DEFAULT_ROUNDS
}

/** Two rounds read `1st 30` and `2nd 30`; any other count (the 2022 Double FITA has four) reads R1, R2, … */
export function roundHeadings(count: number): string[] {
  if (count === DEFAULT_ROUNDS) return ['1st 30', '2nd 30']
  return Array.from({ length: count }, (_, index) => `R${index + 1}`)
}

/** `{line label} · {target}` and the line's tag when it has one. The line is missing when no configured line matched the session. */
export function archerMeta(row: ArcherRow, line: LineView | undefined): string {
  const parts = [line?.label, row.target, line?.tag]
  return parts.filter((part): part is string => part !== undefined && part !== '').join(' · ')
}

/** Arrows in each round, or null when arrows due doesn't split evenly (then nothing is inferred). */
function arrowsPerRound(row: ArcherRow, roundCount: number): number | null {
  const perRound = row.arrowsDue / roundCount
  return row.arrowsDue > 0 && Number.isInteger(perRound) ? perRound : null
}

/**
 * One round's score from EOS, or null for a round the archer hasn't reached. EOS sends 0 for a
 * round not yet shot; null lets the board show a dash there instead of a score of 0.
 */
export function roundScore(row: ArcherRow, index: number, roundCount: number): number | null {
  const score = row.rounds[index]
  if (score === undefined) return null
  const perRound = arrowsPerRound(row, roundCount)
  if (perRound !== null && row.arrowsShot <= index * perRound) return null
  return score
}
