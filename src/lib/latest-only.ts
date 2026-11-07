/**
 * Wraps repeated async loads so only the newest one's answer is applied. A slow request started
 * before a newer one can't land afterwards and put stale data back on screen.
 * The returned function resolves true when its answer was applied, false when a newer call overtook it.
 */
export function latestOnly<T>(apply: (value: T) => void): (load: () => Promise<T>) => Promise<boolean> {
  let newest = 0
  return async (load) => {
    newest += 1
    const mine = newest
    const value = await load()
    if (mine !== newest) return false
    apply(value)
    return true
  }
}
