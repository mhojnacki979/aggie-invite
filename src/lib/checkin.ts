/**
 * Score check-in: the archers of one shooting time grouped by bale, and where each bale stands.
 * Pure logic with no storage or React, written to move into the new EOS's shared package as is.
 */
import { isDone } from './status'
import type { DivisionView, EventView } from './status'
import type { ArcherRow } from './types'

export interface BaleSeat {
  row: ArcherRow
  division: DivisionView
  /** 'A', 'B', … */
  position: string
}

export interface Bale {
  /** null holds the archers whose target EOS didn't write as a bale and letter ("No bale"). */
  number: number | null
  seats: BaleSeat[]
}

export type BaleStatus = 'shooting' | 'ready' | 'checked'

export interface LineProgress {
  total: number
  checked: number
  ready: number
  shooting: number
}

const TARGET = /^(\d+)\s*([A-Za-z])$/

/** `14B` → bale 14, position B. Anything else is null, so the archer lands in "No bale" instead of vanishing. */
export function parseTarget(target: string): { bale: number; position: string } | null {
  const match = TARGET.exec(target.trim())
  if (!match?.[1] || !match[2]) return null
  const bale = Number(match[1])
  return bale > 0 ? { bale, position: match[2].toUpperCase() } : null
}

function seatsOnLine(view: EventView, lineKey: string): { seat: BaleSeat; bale: number | null }[] {
  return view.divisions.flatMap((division) =>
    division.rows
      .filter((row) => view.lineByShooter[row.shooterId]?.key === lineKey)
      .map((row) => {
        const parsed = parseTarget(row.target)
        return { seat: { row, division, position: parsed?.position ?? '' }, bale: parsed?.bale ?? null }
      }),
  )
}

/** That time's bales in number order, each one's archers in letter order, and "No bale" last when anyone is in it. */
export function balesForLine(view: EventView, lineKey: string): Bale[] {
  const byBale = new Map<number | null, BaleSeat[]>()
  for (const { seat, bale } of seatsOnLine(view, lineKey)) byBale.set(bale, [...(byBale.get(bale) ?? []), seat])
  const numbered = [...byBale.keys()].filter((key): key is number => key !== null).sort((a, b) => a - b)
  const keys: (number | null)[] = byBale.has(null) ? [...numbered, null] : numbered
  return keys.map((number) => ({
    number,
    seats: [...(byBale.get(number) ?? [])].sort((a, b) => a.position.localeCompare(b.position)),
  }))
}

/** A check always wins; otherwise ready once every archer on the bale has shot every arrow. */
export function baleStatus(bale: Bale, checked: boolean): BaleStatus {
  if (checked) return 'checked'
  return bale.seats.every((seat) => isDone(seat.row)) ? 'ready' : 'shooting'
}

/** Counts for the progress line. "No bale" can't be checked, so it isn't counted. */
export function lineProgress(bales: Bale[], checkedBales: ReadonlySet<number>): LineProgress {
  const progress: LineProgress = { total: 0, checked: 0, ready: 0, shooting: 0 }
  for (const bale of bales) {
    if (bale.number === null) continue
    progress.total += 1
    progress[baleStatus(bale, checkedBales.has(bale.number))] += 1
  }
  return progress
}

/** The time the page opens on: the one shooting now, else the last one with arrows, else the first. */
export function defaultLineKey(view: EventView): string | null {
  const shooting = view.lines.find((line) => line.status === 'shooting')
  if (shooting) return shooting.key
  const started = view.lines.filter((line) => line.endsShot > 0)
  return started[started.length - 1]?.key ?? view.lines[0]?.key ?? null
}
