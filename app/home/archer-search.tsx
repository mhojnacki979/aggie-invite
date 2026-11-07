'use client'

import { useId, useMemo, useState } from 'react'
import { searchArchers } from '@/lib/search'
import type { EventView } from '@/lib/status'
import type { EventConfig } from '@/lib/types'
import type { Favorites } from '@/lib/use-favorites'
import { ArcherHitRow } from './archer-hit'

const RESULT_LIMIT = 20
const MIN_QUERY = 2

interface SearchProps {
  view: EventView
  config: EventConfig
  scope?: string | null
  /** Null where favorites are off; otherwise each result gets a star. */
  favorites?: Favorites | null
}

/** Find an archer by name; each result opens that archer's division board. */
export function ArcherSearch({ view, config, scope = null, favorites = null }: SearchProps) {
  const [query, setQuery] = useState('')
  const inputId = useId()
  const hits = useMemo(() => searchArchers(view, query, RESULT_LIMIT), [view, query])
  const searching = query.trim().length >= MIN_QUERY
  return (
    <section className="search" aria-label={scope ? `Find an archer: ${scope}` : 'Find an archer'}>
      <label htmlFor={inputId} className="search-label">
        Find an archer
      </label>
      <input
        id={inputId}
        type="search"
        className="search-input"
        placeholder="Type a name"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {searching && hits.length === 0 && <p className="muted">No archers match.</p>}
      {hits.length > 0 && (
        <ul className="hits">
          {hits.map((hit) => (
            <ArcherHitRow key={hit.row.shooterId} hit={hit} config={config} favorites={favorites} />
          ))}
        </ul>
      )}
      {hits.length === RESULT_LIMIT && <p className="muted">Showing the first {RESULT_LIMIT}. Type more of the name to narrow it.</p>}
    </section>
  )
}
