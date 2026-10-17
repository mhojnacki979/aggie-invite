import type { Scorecard } from './types'

export interface LoadCache<T> {
  /** The settled value for `key`, or undefined when nothing has loaded for it yet. */
  peek(key: string): T | undefined
  /** The cached value, the request already in flight for `key`, or a new request from `loader`. */
  load(key: string, loader: () => Promise<T>): Promise<T>
}

/**
 * Remembers each key's value once it loads and shares one request among callers who ask for the
 * same key while it is open. A failure is not remembered, so the next ask tries again.
 */
export function createLoadCache<T>(): LoadCache<T> {
  // Boxed so a settled `undefined`-or-`null` value is told apart from a miss without a cast.
  const settled = new Map<string, { value: T }>()
  const inFlight = new Map<string, Promise<T>>()
  return {
    peek: (key) => settled.get(key)?.value,
    load(key, loader) {
      const hit = settled.get(key)
      if (hit) return Promise.resolve(hit.value)
      const open = inFlight.get(key)
      if (open) return open
      const request = loader().then(
        (value) => {
          settled.set(key, { value })
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

/**
 * Scorecards fetched this session, shared by every division board. EOS allows 60 calls a minute
 * across all endpoints, so a repeat tap must never cost one. `null` is a saved "no arrows shot".
 */
export const sessionCards: LoadCache<Scorecard | null> = createLoadCache()

/** Live years key on the EOS tournament id, finished ones on their snapshot slug. */
export function cardKey(scope: string, shooterId: string): string {
  return `${scope}|${shooterId}`
}
