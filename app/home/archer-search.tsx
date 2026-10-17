'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import { searchArchers } from '@/lib/search'
import type { ArcherHit } from '@/lib/search'
import type { EventView } from '@/lib/status'
import type { EventConfig } from '@/lib/types'
import { DivisionBadge } from './division-badge'
import { divisionHref, ordinal } from './format'

const RESULT_LIMIT = 20
const MIN_QUERY = 2

function lineText(hit: ArcherHit): string {
  const parts = [hit.division.display.label]
  if (hit.line) parts.push(hit.line.tag ? `${hit.line.label} · ${hit.line.tag}` : hit.line.label)
  parts.push(`Target ${hit.row.target}`)
  return parts.join(' · ')
}

function ResultRow({ hit, config }: { hit: ArcherHit; config: EventConfig }) {
  const started = hit.row.arrowsShot > 0
  return (
    <li>
      <Link href={divisionHref(config, hit.division.display.slug, hit.row.shooterId)} className="hit">
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

/** Find an archer by name; each result opens that archer's division board. */
export function ArcherSearch({ view, config, scope = null }: { view: EventView; config: EventConfig; scope?: string | null }) {
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
            <ResultRow key={hit.row.shooterId} hit={hit} config={config} />
          ))}
        </ul>
      )}
      {hits.length === RESULT_LIMIT && <p className="muted">Showing the first {RESULT_LIMIT}. Type more of the name to narrow it.</p>}
    </section>
  )
}
