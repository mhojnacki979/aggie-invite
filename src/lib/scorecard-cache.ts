import type { EventConfig, Scorecard } from './types'

export interface LoadCache<T> {
  /** The settled, unexpired value for `key`, or undefined when there is none. */
  peek(key: string): T | undefined
  /**
   * The cached value, the request already in flight for `key`, or a new request from `loader`.
   * `ttlMs` is how long the result stays good once it lands; leave it out to keep it for the session.
   */
  load(key: string, loader: () => Promise<T>, ttlMs?: number): Promise<T>
}

interface Entry<T> {
  value: T
  expiresAt: number
}

/**
 * Remembers each key's value once it loads and shares one request among callers who ask for the
 * same key while it is open. A failure is not remembered, so the next ask tries again. A value
 * loaded with a TTL is dropped once that time has passed, so the next ask fetches it afresh.
 */
export function createLoadCache<T>(now: () => number = Date.now): LoadCache<T> {
  // Boxed so a settled `undefined`-or-`null` value is told apart from a miss without a cast.
  const settled = new Map<string, Entry<T>>()
  const inFlight = new Map<string, Promise<T>>()
  const fresh = (key: string): Entry<T> | undefined => {
    const entry = settled.get(key)
    if (entry && entry.expiresAt <= now()) settled.delete(key)
    return settled.get(key)
  }
  return {
    peek: (key) => fresh(key)?.value,
    load(key, loader, ttlMs) {
      const hit = fresh(key)
      if (hit) return Promise.resolve(hit.value)
      const open = inFlight.get(key)
      if (open) return open
      const request = loader().then(
        (value) => {
          settled.set(key, { value, expiresAt: ttlMs === undefined ? Number.POSITIVE_INFINITY : now() + ttlMs })
          inFlight.delete(key)
          return value
        },
        (error: unknown) => {
          inFlight.delete(key)
          throw error
        },
      )
      inFlight.set(key, request)
      return request
    },
  }
}

/** A live archer gains an end every few minutes, so a live scorecard is only good for this long. */
export const SCORECARD_TTL_MS = 60_000

/** How long a scorecard stays good: a live event's for a minute, a finished one's (our own saved JSON) for the session. */
export function scorecardTtl(config: Pick<EventConfig, 'live'>): number | undefined {
  return config.live ? SCORECARD_TTL_MS : undefined
}

/**
 * Scorecards fetched this session, shared by every division board. EOS allows 60 calls a minute
 * across all endpoints, so a repeat tap must not cost one (live cards expire after SCORECARD_TTL_MS; frozen ones never do). `null` is a saved "no arrows shot".
 */
export const sessionCards: LoadCache<Scorecard | null> = createLoadCache()

/** Live years key on the EOS tournament id, finished ones on their snapshot slug. */
export function cardKey(scope: string, shooterId: string): string {
  return `${scope}|${shooterId}`
}
