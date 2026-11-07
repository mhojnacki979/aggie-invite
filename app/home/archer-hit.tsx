'use client'

import Link from 'next/link'
import type { ArcherHit } from '@/lib/search'
import type { EventConfig } from '@/lib/types'
import type { Favorites } from '@/lib/use-favorites'
import { FavoriteStar } from '../components/favorite-star'
import { DivisionBadge } from './division-badge'
import { divisionHref, ordinal } from './format'

function lineText(hit: ArcherHit): string {
  const parts = [hit.division.display.label]
  if (hit.line) parts.push(hit.line.tag ? `${hit.line.label} · ${hit.line.tag}` : hit.line.label)
  parts.push(`Target ${hit.row.target}`)
  return parts.join(' · ')
}

/** One archer as a search result or a favorite: name, line, score and place, linking to their division board. */
export function ArcherHitRow({ hit, config, favorites }: { hit: ArcherHit; config: EventConfig; favorites: Favorites | null }) {
  const started = hit.row.arrowsShot > 0
  const id = hit.row.shooterId
  return (
    <li className="hit-row">
      {favorites && <FavoriteStar name={hit.row.name} on={favorites.has(id)} onToggle={() => favorites.toggle(id)} />}
      <Link href={divisionHref(config, hit.division.display.slug, id)} className="hit">
        <span className="hit-main">
          <b>{hit.row.name}</b>
          <span className="hit-meta">{lineText(hit)}</span>
        </span>
        <span className="hit-score">
          <span className="num">{started ? hit.row.total : '—'}</span>
          <span className="hit-place">{started ? ordinal(hit.place) : 'Not started'}</span>
        </span>
        <DivisionBadge division={hit.division} />
      </Link>
    </li>
  )
}
