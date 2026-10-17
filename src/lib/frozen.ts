import type { ArcherRow, Scorecard } from './types'

export interface FrozenEvent {
  year: number
  slug: string
  name: string
  dates: string
  tournamentId: string
  frozenAt: string
  rows: ArcherRow[]
}

type CardMap = Record<string, Scorecard>

const cardCache = new Map<string, Promise<CardMap>>()

/** These files are written by our own freeze script and served from the same origin, so the shape is trusted. */
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`)
  return res.json()
}

/** A finished tournament's saved leaderboard (written by `pnpm freeze`). */
export async function loadFrozen(slug: string): Promise<FrozenEvent> {
  return getJson<FrozenEvent>(`/data/${slug}.json`)
}

function loadCards(slug: string): Promise<CardMap> {
  const cached = cardCache.get(slug)
  if (cached) return cached
  const pending = getJson<CardMap>(`/data/${slug}-cards.json`).catch((error: unknown) => {
    // Don't cache a failure: the next tap should try again.
    cardCache.delete(slug)
    throw error
  })
  cardCache.set(slug, pending)
  return pending
}

/** One archer's saved scorecard, or null when they never shot an arrow. */
export async function loadFrozenCard(slug: string, shooterId: string): Promise<Scorecard | null> {
  const cards = await loadCards(slug)
  return cards[shooterId] ?? null
}
