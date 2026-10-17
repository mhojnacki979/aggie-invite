import type { DivisionView } from './status'

export type BadgeKind = 'tie' | 'final' | 'provisional'

const SHOOT_OFF_NOTE = 'Same score, 10s and 9s: shoot-off needed'

/**
 * Which badges a division wears. A tie wins over Final, since it needs a shoot-off, but a tie in a
 * division still shooting also keeps Provisional: a podium that can still change must never read as settled.
 */
export function badgesFor(division: Pick<DivisionView, 'status' | 'tieFor'>): BadgeKind[] {
  const badges: BadgeKind[] = []
  if (division.tieFor !== null) badges.push('tie')
  else if (division.status === 'final') badges.push('final')
  if (division.status === 'provisional') badges.push('provisional')
  return badges
}

function shotNote(shot: number, count: number): string {
  return shot === count ? `All ${shot} have shot` : `${shot} of ${count} have shot, ${count - shot} with no score`
}

/**
 * The lines under a podium card. "All N have shot" is only true when nobody is unaccounted for: an
 * archer with no arrows may be a no-show or may have scores still on paper, and the page cannot tell which.
 */
export function footerLines(division: Pick<DivisionView, 'remaining' | 'count' | 'shot' | 'tieFor'>): string[] {
  const { remaining, count, shot, tieFor } = division
  const lines = [remaining > 0 ? `${remaining} of ${count} still to shoot` : shotNote(shot, count)]
  return tieFor === null ? lines : [...lines, SHOOT_OFF_NOTE]
}
