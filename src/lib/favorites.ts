import { z } from 'zod'
import type { ArcherHit } from './search'
import type { EventView } from './status'
import type { EventConfig } from './types'

/** The two calls favorites need from localStorage; a plain object stands in for it in tests. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const savedSchema = z.array(z.unknown())

/** Shooter ids only mean something inside one tournament, so each tournament keeps its own list. */
export function favoritesKey(config: EventConfig): string {
  return `aggie-favorites:${config.tournamentId}`
}

/** The saved favorites, oldest first. Anything unreadable (private mode, a hand-edited value) reads as none. */
export function readFavorites(storage: StorageLike, key: string): string[] {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return []
    const parsed = savedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return []
    const ids = parsed.data.filter((id): id is string => typeof id === 'string')
    return [...new Set(ids)]
  } catch {
    return []
  }
}

/** Save the list; a refused write (private mode, full storage) just means it won't survive a reload. */
export function writeFavorites(storage: StorageLike, key: string, ids: string[]): void {
  try {
    storage.setItem(key, JSON.stringify(ids))
  } catch {
    // Nothing to do: the list still works for this visit.
  }
}

/** Add an archer to the end of the list, or take them off it. */
export function toggleFavorite(ids: string[], shooterId: string): string[] {
  return ids.includes(shooterId) ? ids.filter((id) => id !== shooterId) : [...ids, shooterId]
}

/** Each favorite's current row, division and place, in the order they were added. */
export function favoriteHits(view: EventView, ids: string[]): ArcherHit[] {
  const byId = new Map<string, ArcherHit>()
  for (const division of view.divisions) {
    for (const row of division.rows) {
      byId.set(row.shooterId, { row, division, line: view.lineByShooter[row.shooterId], place: row.rank })
    }
  }
  return ids.flatMap((id) => {
    const hit = byId.get(id)
    return hit ? [hit] : []
  })
}
