import { roundHeadings } from './board-columns'
import type { EndScore } from './types'

/** One round's ends on a scorecard, with that round's subtotal. */
export interface RoundGroup {
  /** `1st 30`, `2nd 30`, `R1`…; null when the card can't be split into rounds. */
  heading: string | null
  /** The end number (1-based) this group starts at. */
  firstEnd: number
  ends: EndScore[]
  subtotal: number
}

function sum(ends: EndScore[]): number {
  return ends.reduce((total, end) => total + end.score, 0)
}

/** Ends in each round, read from the end size so 3-arrow and 6-arrow ends both work; null if it doesn't divide evenly. */
function endsPerRound(ends: EndScore[], arrowsDue: number, roundCount: number): number | null {
  const arrowsPerEnd = Math.max(...ends.map((end) => end.arrows.length))
  const perRound = arrowsDue / roundCount / arrowsPerEnd
  return arrowsDue > 0 && arrowsPerEnd > 0 && Number.isInteger(perRound) ? perRound : null
}

/**
 * A scorecard's ends grouped by round, each with its subtotal. Rounds with no ends yet are left out.
 * When the rounds can't be told apart, the whole card is one untitled group.
 */
export function roundGroups(ends: EndScore[], arrowsDue: number, roundCount: number): RoundGroup[] {
  if (ends.length === 0) return []
  const perRound = endsPerRound(ends, arrowsDue, roundCount)
  if (perRound === null) return [{ heading: null, firstEnd: 1, ends, subtotal: sum(ends) }]
  const headings = roundHeadings(roundCount)
  const groups: RoundGroup[] = []
  for (let start = 0; start < ends.length; start += perRound) {
    const slice = ends.slice(start, start + perRound)
    const heading = headings[groups.length] ?? `R${groups.length + 1}`
    groups.push({ heading, firstEnd: start + 1, ends: slice, subtotal: sum(slice) })
  }
  return groups
}
