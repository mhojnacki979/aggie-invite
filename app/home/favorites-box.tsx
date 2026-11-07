'use client'

import { useMemo } from 'react'
import { favoriteHits } from '@/lib/favorites'
import type { EventView } from '@/lib/status'
import type { EventConfig } from '@/lib/types'
import type { Favorites } from '@/lib/use-favorites'
import { ArcherHitRow } from './archer-hit'

/** "Your archers": the visitor's favorites with live score and place. Hidden until they star someone. */
export function FavoritesBox({ view, config, favorites }: { view: EventView; config: EventConfig; favorites: Favorites }) {
  const hits = useMemo(() => favoriteHits(view, favorites.ids), [view, favorites.ids])
  if (hits.length === 0) return null
  return (
    <section className="search favorites" aria-labelledby="favorites-heading">
      <h2 id="favorites-heading" className="search-label">
        <span aria-hidden="true">★ </span>Your archers
      </h2>
      <ul className="hits">
        {hits.map((hit) => (
          <ArcherHitRow key={hit.row.shooterId} hit={hit} config={config} favorites={favorites} />
        ))}
      </ul>
    </section>
  )
}
