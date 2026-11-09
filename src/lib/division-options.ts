import type { DivisionView } from './status'

/**
 * The divisions a board lists, in board order. A live event lists every division, unscored ones
 * as their archers at 0 (Michael, 2026-11-06); a finished year keeps scored divisions only, so a
 * no-show division never reads as zeros.
 */
export function listedDivisions(divisions: DivisionView[], live: boolean): DivisionView[] {
  return live ? divisions : divisions.filter((division) => division.shot > 0)
}
