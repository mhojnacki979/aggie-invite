import type { ArcherRow } from './types'
import type { DivisionView, EventView } from './status'

/**
 * The divisions to read out at the ceremony: only those where someone shot, in the standard
 * division ordering, until the club supplies its own running order.
 */
export function awardsOrder(view: EventView): DivisionView[] {
  return view.divisions.filter((division) => division.shot > 0)
}

const FORWARD_KEYS = new Set(['ArrowRight', ' ', 'PageDown'])
const BACK_KEYS = new Set(['ArrowLeft', 'PageUp'])

/** The slide a clicker key moves to from slide `i` of `n`; other keys leave it where it is. */
export function stepIndex(i: number, n: number, key: string): number {
  const last = Math.max(0, n - 1)
  if (key === 'Home') return 0
  if (FORWARD_KEYS.has(key)) return Math.min(last, i + 1)
  if (BACK_KEYS.has(key)) return Math.max(0, i - 1)
  return i
}

/**
 * `settled`: one archer holds this place. `tie`: two or more share it and a shoot-off decides.
 * `covered`: a tie above takes this place as well, so nobody can be named yet.
 * `empty`: fewer archers shot than there are places.
 */
export type SlotKind = 'settled' | 'tie' | 'covered' | 'empty'

export interface PlaceSlot {
  place: 1 | 2 | 3
  kind: SlotKind
  archers: ArcherRow[]
}

const PLACES = [1, 2, 3] as const

/**
 * The podium as three places, each saying whether it can be read out. A tie takes its own place and
 * every place its extra archers would have filled, so a tie for 1st among two leaves 2nd covered.
 */
export function podiumSlots(division: DivisionView): PlaceSlot[] {
  let coveredUntil = 0
  return PLACES.map((place): PlaceSlot => {
    const archers = division.podium.filter((row) => row.rank === place)
    if (archers.length > 1) {
      // Two tied archers hold their own place plus the next one.
      coveredUntil = place + archers.length - 1
      return { place, kind: 'tie', archers }
    }
    if (archers.length === 1) return { place, kind: 'settled', archers }
    return { place, kind: place <= coveredUntil ? 'covered' : 'empty', archers }
  })
}
