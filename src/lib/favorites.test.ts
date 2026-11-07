import { describe, expect, it } from 'vitest'
import { browserStorage, favoriteHits, favoritesKey, readFavorites, toggleFavorite, writeFavorites } from './favorites'
import type { StorageLike } from './favorites'
import type { DivisionView, EventView } from './status'
import type { ArcherRow, EventConfig } from './types'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const broken: StorageLike = {
  getItem: () => {
    throw new Error('private mode')
  },
  setItem: () => {
    throw new Error('quota')
  },
}

function row(shooterId: string, rank: number): ArcherRow {
  return {
    shooterId,
    name: `Archer ${shooterId}`,
    division: 'Recurve U15 Female',
    rank,
    rounds: [150, 150],
    total: 300,
    tens: 9,
    nines: 10,
    target: '14B',
    session: '',
    arrowsShot: 60,
    arrowsDue: 60,
    avg: '',
  }
}

function eventView(rows: ArcherRow[]): EventView {
  const division = { name: 'Recurve U15 Female', rows } as DivisionView
  return { lines: [], divisions: [division], lineByShooter: {} }
}

describe('favoritesKey', () => {
  it('is scoped to the tournament, since shooter ids belong to one tournament', () => {
    expect(favoritesKey({ tournamentId: 'abc' } as EventConfig)).toBe('aggie-favorites:abc')
  })
})

describe('readFavorites', () => {
  it('reads the saved ids', () => {
    expect(readFavorites(memoryStorage({ k: '["7","3"]' }), 'k')).toEqual(['7', '3'])
  })

  it('drops duplicates and anything that is not a string', () => {
    expect(readFavorites(memoryStorage({ k: '["7",7,"7",null,"3"]' }), 'k')).toEqual(['7', '3'])
  })

  it('starts empty when nothing is saved, the value is not a list, or storage is unavailable', () => {
    expect(readFavorites(memoryStorage(), 'k')).toEqual([])
    expect(readFavorites(memoryStorage({ k: '{oops' }), 'k')).toEqual([])
    expect(readFavorites(memoryStorage({ k: '"7"' }), 'k')).toEqual([])
    expect(readFavorites(broken, 'k')).toEqual([])
  })
})

describe('writeFavorites', () => {
  it('saves the ids as JSON', () => {
    const storage = memoryStorage()
    writeFavorites(storage, 'k', ['7', '3'])
    expect(storage.data.k).toBe('["7","3"]')
  })

  it('does not throw when storage refuses the write', () => {
    expect(() => writeFavorites(broken, 'k', ['7'])).not.toThrow()
  })
})

describe('toggleFavorite', () => {
  it('adds a new archer at the end and removes one already there', () => {
    expect(toggleFavorite(['7'], '3')).toEqual(['7', '3'])
    expect(toggleFavorite(['7', '3'], '7')).toEqual(['3'])
  })
})

describe('favoriteHits', () => {
  it('finds each favorite in the order they were added, with their place', () => {
    const view = eventView([row('1', 1), row('2', 2), row('3', 3)])
    const hits = favoriteHits(view, ['3', '1'])
    expect(hits.map((hit) => [hit.row.shooterId, hit.place])).toEqual([
      ['3', 3],
      ['1', 1],
    ])
  })

  it('skips a favorite no longer on the scoreboard', () => {
    expect(favoriteHits(eventView([row('1', 1)]), ['9', '1'])).toHaveLength(1)
  })
})

describe('browserStorage', () => {
  it('is null when reading localStorage throws, instead of crashing the page', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: Object.defineProperty({}, 'localStorage', {
        get: () => {
          throw new Error('SecurityError')
        },
      }),
    })
    try {
      expect(browserStorage()).toBeNull()
    } finally {
      if (original) Object.defineProperty(globalThis, 'window', original)
      else Reflect.deleteProperty(globalThis, 'window')
    }
  })
})
