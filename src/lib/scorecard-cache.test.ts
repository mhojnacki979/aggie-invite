import { describe, expect, it, vi } from 'vitest'
import { SCORECARD_TTL_MS, cardKey, createLoadCache } from './scorecard-cache'

describe('createLoadCache', () => {
  it('serves a repeat ask from the cache without calling the loader again', async () => {
    const cache = createLoadCache<number>()
    const loader = vi.fn(() => Promise.resolve(7))
    expect(await cache.load('a', loader)).toBe(7)
    expect(await cache.load('a', loader)).toBe(7)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(cache.peek('a')).toBe(7)
  })

  it('shares one request among callers who ask while it is open', async () => {
    const cache = createLoadCache<number>()
    let resolve: (value: number) => void = () => undefined
    const loader = vi.fn(() => new Promise<number>((res) => (resolve = res)))
    const first = cache.load('a', loader)
    const second = cache.load('a', loader)
    resolve(3)
    expect(await Promise.all([first, second])).toEqual([3, 3])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('keeps keys apart', async () => {
    const cache = createLoadCache<number>()
    const loader = vi.fn((n: number) => Promise.resolve(n))
    await cache.load('a', () => loader(1))
    await cache.load('b', () => loader(2))
    expect(loader).toHaveBeenCalledTimes(2)
    expect(cache.peek('b')).toBe(2)
  })

  it('does not remember a failure, so the next ask retries', async () => {
    const cache = createLoadCache<number>()
    const loader = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(5)
    await expect(cache.load('a', loader)).rejects.toThrow('busy')
    expect(cache.peek('a')).toBeUndefined()
    expect(await cache.load('a', loader)).toBe(5)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('remembers a null result as a real answer', async () => {
    const cache = createLoadCache<number | null>()
    const loader = vi.fn(() => Promise.resolve(null))
    await cache.load('a', loader)
    await cache.load('a', loader)
    expect(cache.peek('a')).toBeNull()
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('createLoadCache with a TTL', () => {
  function clocked() {
    let time = 1_000
    const cache = createLoadCache<number>(() => time)
    return { cache, advance: (ms: number) => (time += ms) }
  }

  it('serves a repeat ask inside the TTL from the cache', async () => {
    const { cache, advance } = clocked()
    const loader = vi.fn(() => Promise.resolve(1))
    await cache.load('a', loader, SCORECARD_TTL_MS)
    advance(SCORECARD_TTL_MS - 1)
    expect(cache.peek('a')).toBe(1)
    await cache.load('a', loader, SCORECARD_TTL_MS)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('fetches again once the TTL has passed', async () => {
    const { cache, advance } = clocked()
    const loader = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    await cache.load('a', loader, SCORECARD_TTL_MS)
    advance(SCORECARD_TTL_MS)
    expect(cache.peek('a')).toBeUndefined()
    expect(await cache.load('a', loader, SCORECARD_TTL_MS)).toBe(2)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('keeps a value loaded without a TTL for good', async () => {
    const { cache, advance } = clocked()
    const loader = vi.fn(() => Promise.resolve(1))
    await cache.load('a', loader)
    advance(24 * 60 * 60 * 1000)
    await cache.load('a', loader)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('still shares one request for a double ask with a TTL', async () => {
    const { cache } = clocked()
    const loader = vi.fn(() => Promise.resolve(1))
    await Promise.all([cache.load('a', loader, SCORECARD_TTL_MS), cache.load('a', loader, SCORECARD_TTL_MS)])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('is a minute', () => {
    expect(SCORECARD_TTL_MS).toBe(60_000)
  })
})

describe('cardKey', () => {
  it('joins the scope and the shooter', () => {
    expect(cardKey('2025', 'abc')).toBe('2025|abc')
  })
})
