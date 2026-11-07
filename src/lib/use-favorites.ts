'use client'

import { useCallback, useEffect, useState } from 'react'
import { browserStorage, favoritesKey, readFavorites, toggleFavorite, writeFavorites } from './favorites'
import type { EventConfig } from './types'

export interface Favorites {
  /** Favorited shooter ids, oldest first. */
  ids: string[]
  has: (shooterId: string) => boolean
  toggle: (shooterId: string) => void
}

/**
 * The visitor's favorite archers for this tournament, saved on their own device. Returns null when
 * favorites are off (finished years). The list loads after the first render, because the static
 * page is built with no favorites and has to match that before it can show them.
 */
export function useFavorites(config: EventConfig, enabled: boolean): Favorites | null {
  const key = favoritesKey(config)
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    const storage = browserStorage()
    if (!enabled || storage === null) return
    setIds(readFavorites(storage, key))
    // Another tab changing the list (favorited on the division page, say) shows up here too.
    const onStorage = (event: StorageEvent): void => {
      if (event.key === key) setIds(readFavorites(storage, key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [enabled, key])

  const toggle = useCallback(
    (shooterId: string): void => {
      setIds((current) => {
        const next = toggleFavorite(current, shooterId)
        const storage = browserStorage()
        if (storage !== null) writeFavorites(storage, key, next)
        return next
      })
    },
    [key],
  )

  const has = useCallback((shooterId: string): boolean => ids.includes(shooterId), [ids])
  return enabled ? { ids, has, toggle } : null
}
