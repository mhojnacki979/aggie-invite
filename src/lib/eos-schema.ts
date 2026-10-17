/**
 * Zod boundary for the two EOS responses this site reads. Raw EOS shapes go
 * in; the app's own types (see types.ts) come out. Nothing past this file
 * touches untyped data.
 */
import { z } from 'zod'
import type { ArcherRow, EndScore, Scorecard } from './types'

const record = z.record(z.unknown())

/** EOS sends the same field as a string or a number depending on the endpoint. */
const text = z.union([z.string(), z.number()]).transform(String)
const optionalText = text.nullish().transform((v) => v ?? '')

const archerRowSchema = z.object({
  shooter_id: text,
  name: z.string(),
  rank: z.coerce.number(),
  round_1: z.coerce.number(),
  round_2: z.coerce.number(),
  total_score: z.coerce.number(),
  tens_count: z.coerce.number(),
  nine_count: z.coerce.number(),
  target: optionalText,
  session: optionalText,
  total_attended_arrows_count: z.coerce.number(),
  total_arrow_count: z.coerce.number(),
  avg_count: optionalText,
})

function toArcherRow(r: z.infer<typeof archerRowSchema>, division: string): ArcherRow {
  return {
    shooterId: r.shooter_id,
    name: r.name.trim(),
    division,
    rank: r.rank,
    half1: r.round_1,
    half2: r.round_2,
    total: r.total_score,
    tens: r.tens_count,
    nines: r.nine_count,
    target: r.target,
    session: r.session,
    arrowsShot: r.total_attended_arrows_count,
    arrowsDue: r.total_arrow_count,
    avg: r.avg_count,
  }
}

const scoreListSchema = z.object({ sortingResult: z.record(z.unknown()) })

/**
 * A division group mixes archer rows with metadata keys (max_round_count,
 * elimination_round_list, ...). Only objects with a name are archers.
 */
export function parseScoreList(data: unknown): { rows: ArcherRow[]; skipped: number } {
  const { sortingResult } = scoreListSchema.parse(data)
  const rows: ArcherRow[] = []
  let skipped = 0
  for (const [division, group] of Object.entries(sortingResult)) {
    const members = record.safeParse(group)
    if (!members.success) continue
    for (const value of Object.values(members.data)) {
      const member = record.safeParse(value)
      if (!member.success || !('name' in member.data)) continue
      const parsed = archerRowSchema.safeParse(member.data)
      if (parsed.success) rows.push(toArcherRow(parsed.data, division))
      else skipped += 1
    }
  }
  return { rows, skipped }
}

const scorecardSchema = z.object({
  shooter_name: z.string(),
  total_score: z.coerce.number(),
  avg_count: optionalText,
  target_name_position: optionalText,
  slot_list: z.array(z.object({ round_score_list: z.array(record) })),
})

/** A strict number: rejects null, undefined, '' and NaN instead of coercing to 0. */
const strictNumber = z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number())

const arrowSchema = z.object({ score: z.union([z.string().min(1), z.number()]).transform(String) })

function keyOrder(prefix: string): (a: string, b: string) => number {
  return (a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length))
}

function arrowsOf(end: Record<string, unknown>): string[] {
  return Object.keys(end)
    .filter((k) => /^arrow\d+$/.test(k))
    .sort(keyOrder('arrow'))
    .flatMap((k) => {
      const arrow = arrowSchema.safeParse(end[k])
      return arrow.success ? [arrow.data.score] : []
    })
}

function endsOfRound(round: Record<string, unknown>): { arrows: string[]; score: number }[] {
  return Object.keys(round)
    .filter((k) => /^end\d+$/.test(k))
    .sort(keyOrder('end'))
    .flatMap((k) => {
      const end = record.safeParse(round[k])
      if (!end.success) return []
      const score = strictNumber.safeParse(end.data.per_end_total)
      return score.success ? [{ arrows: arrowsOf(end.data), score: score.data }] : []
    })
}

/**
 * Flatten slots, rounds and ends into one list. EOS `end_total` resets each
 * round, so `running` is summed here across all rounds.
 */
export function parseScorecard(data: unknown): Scorecard {
  const d = scorecardSchema.parse(data)
  let running = 0
  const ends: EndScore[] = d.slot_list
    .flatMap((slot) => slot.round_score_list)
    .flatMap(endsOfRound)
    .map((end) => {
      running += end.score
      return { arrows: end.arrows, score: end.score, running }
    })
  return {
    name: d.shooter_name.trim(),
    total: d.total_score,
    avg: d.avg_count,
    target: d.target_name_position,
    ends,
  }
}
