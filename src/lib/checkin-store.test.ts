import { describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from './checkin-store'

describe('createMemoryStore', () => {
  it('lists a checked bale with who and when', async () => {
    const store = createMemoryStore()
    await store.check('t1', 'sat8', 14)
    const [check] = await store.list('t1')
    expect(check).toMatchObject({ lineKey: 'sat8', bale: 14, checkedBy: 'crew' })
    expect(Number.isNaN(Date.parse(check?.checkedAt ?? ''))).toBe(false)
  })

  it('treats checking the same bale twice as one check, the way two tablets tapping at once must', async () => {
    const store = createMemoryStore()
    await store.check('t1', 'sat8', 14)
    await expect(store.check('t1', 'sat8', 14)).resolves.toBeUndefined()
    expect(await store.list('t1')).toHaveLength(1)
  })

  it('undoes a check', async () => {
    const store = createMemoryStore()
    await store.check('t1', 'sat8', 14)
    await store.uncheck('t1', 'sat8', 14)
    expect(await store.list('t1')).toEqual([])
  })

  it('keeps tournaments apart', async () => {
    const store = createMemoryStore()
    await store.check('t1', 'sat8', 14)
    expect(await store.list('t2')).toEqual([])
  })

  it('tells subscribers about checks and undos until they unsubscribe', async () => {
    const store = createMemoryStore()
    const onChange = vi.fn()
    const stop = store.subscribe('t1', onChange)
    await store.check('t1', 'sat8', 14)
    await store.uncheck('t1', 'sat8', 14)
    stop()
    await store.check('t1', 'sat8', 15)
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
