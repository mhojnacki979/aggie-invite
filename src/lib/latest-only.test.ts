import { describe, expect, it } from 'vitest'
import { latestOnly } from './latest-only'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('latestOnly', () => {
  it('drops an older answer that arrives after a newer one, so a slow refetch cannot undo a fresh one', async () => {
    const applied: string[] = []
    const slow = deferred<string>()
    const fast = deferred<string>()
    const run = latestOnly<string>((value) => applied.push(value))
    const first = run(() => slow.promise)
    const second = run(() => fast.promise)
    fast.resolve('newer')
    await second
    slow.resolve('older')
    await first
    expect(applied).toEqual(['newer'])
  })

  it('applies answers that arrive in order', async () => {
    const applied: number[] = []
    const run = latestOnly<number>((value) => applied.push(value))
    await run(async () => 1)
    await run(async () => 2)
    expect(applied).toEqual([1, 2])
  })

  it('reports whether this call was the one applied, and lets errors through', async () => {
    const run = latestOnly<number>(() => undefined)
    await expect(run(async () => 1)).resolves.toBe(true)
    await expect(run(async () => Promise.reject(new Error('offline')))).rejects.toThrow('offline')
  })
})
