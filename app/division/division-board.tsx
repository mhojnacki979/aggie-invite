'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { SCORING_SOON_NOTE } from '@/config/event'
import { eventHomeHref, resolveEventConfig } from '@/lib/division-route'
import type { FetchState } from '@/lib/fetch-state'
import { allLinesFinal, buildEventView } from '@/lib/status'
import type { DivisionView, EventView } from '@/lib/status'
import type { ArcherRow, EventConfig } from '@/lib/types'
import { isUnconfigured, useEventData } from '@/lib/use-event-data'
import { ScorecardModal } from '../components/scorecard-modal'
import { DivisionBadge } from '../home/division-badge'
import { archerCount } from '../home/format'
import { StatusLine } from '../home/status-line'
import { DivisionTable } from './division-table'
import { useScorecard } from './use-scorecard'
import './division.css'

function NotFound({ text = 'Division not found' }: { text?: string }) {
  return (
    <div className="dv-page">
      <p className="dv-notfound">{text}</p>
      <Link href="/" className="dv-back">
        ← Back home
      </Link>
    </div>
  )
}

/** Said instead of the board until scores arrive, so a half-empty board is never mistaken for a real one. */
function loadingText(config: EventConfig, state: FetchState): string {
  if (!state.error) return 'Loading scores…'
  return config.live ? 'Waiting for the scoreboard…' : "Couldn't load these results. Reload to try again."
}

/** The event this board belongs to. A tournament inside a multi-tournament year already names itself in its section label, so the year stands in for the name. */
function eventLabel(config: EventConfig): string {
  if (config.sectionLabel === null) return config.name
  return `${config.year} Aggie Invitational · ${config.sectionLabel}`
}

function Header({ division, config }: { division: DivisionView; config: EventConfig }) {
  return (
    <header className="dv-head">
      <Link href={eventHomeHref(config)} className="dv-back">
        ← All divisions
      </Link>
      <h1 className="dv-title">{division.display.label}</h1>
      <div className="dv-sub">
        <DivisionBadge division={division} />
        <span>{archerCount(division.count)}</span>
        <span className="dv-event">{eventLabel(config)}</span>
      </div>
    </header>
  )
}

/** `{division label} · {line label} · Target {target}`; the line is left out when none matched. */
function cardSubtitle(row: ArcherRow, division: DivisionView, view: EventView): string {
  const line = view.lineByShooter[row.shooterId]
  const parts = [division.display.label, line?.label, row.target ? `Target ${row.target}` : undefined]
  return parts.filter((part): part is string => part !== undefined).join(' · ')
}

function Loaded({ config, division, view, state }: { config: EventConfig; division: DivisionView; view: EventView; state: FetchState }) {
  const highlightId = useSearchParams().get('a')
  const card = useScorecard(config)
  // The board keeps polling behind the modal, so show the archer's latest row, not the one tapped.
  const open = card.open && (division.rows.find((row) => row.shooterId === card.open?.shooterId) ?? card.open)
  return (
    <div className="dv-page">
      <Header division={division} config={config} />
      {!isUnconfigured(config) && <StatusLine config={config} state={state} />}
      <DivisionTable
        division={division}
        lineByShooter={view.lineByShooter}
        highlightId={highlightId}
        pending={card.pending}
        onOpen={card.show}
      />
      {open && (
        <ScorecardModal
          row={open}
          subtitle={cardSubtitle(open, division, view)}
          view={card.view}
          onClose={card.close}
          onRetry={card.retry}
        />
      )}
    </div>
  )
}

function Board({ config, slug }: { config: EventConfig; slug: string }) {
  const [idle, setIdle] = useState(false)
  const state = useEventData(config, idle)
  const view = useMemo(() => buildEventView(state.rows ?? [], config), [state.rows, config])
  const finished = allLinesFinal(view)
  useEffect(() => setIdle(finished), [finished])

  if (isUnconfigured(config)) return <NotFound text={SCORING_SOON_NOTE} />
  if (state.rows === null) return <p className="dv-page muted">{loadingText(config, state)}</p>
  const division = view.divisions.find((item) => item.display.slug === slug)
  if (!division) return <NotFound />
  return <Loaded config={config} division={division} view={view} state={state} />
}

/**
 * The full leaderboard for one division, addressed as `/division/?d=<slug>[&y=<year>][&t=<tournament>][&a=<shooterId>]`
 * because 2026's divisions are not known at build time. Reads the query string, so whoever renders it
 * needs a Suspense boundary above it.
 */
export function DivisionBoard() {
  const params = useSearchParams()
  const year = params.get('y')
  const tournament = params.get('t')
  // Archive configs are rebuilt on every call; memoize so the polling and view hooks see one object.
  const config = useMemo(() => resolveEventConfig(year, tournament), [year, tournament])
  const slug = params.get('d')
  if (!config || !slug) return <NotFound />
  return <Board config={config} slug={slug} />
}
