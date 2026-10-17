'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SCORING_SOON_NOTE } from '@/config/event'
import { parsePreview, cutAt } from '@/lib/preview'
import { deriveLines } from '@/lib/schedule'
import { buildEventView } from '@/lib/status'
import type { DivisionView, EventView } from '@/lib/status'
import type { FetchState } from '@/lib/fetch-state'
import type { ArcherRow, EventConfig } from '@/lib/types'
import { isUnconfigured, useEventData } from '@/lib/use-event-data'
import { ArcherSearch } from './archer-search'
import { divisionHref } from './format'
import { LineStrip } from './line-strip'
import { PodiumCard } from './podium-card'
import { StatusLine } from './status-line'
import './home.css'

type Preview = NonNullable<ReturnType<typeof parsePreview>>

/** The rows with `?preview=L-E` applied: the event as it stood at end E of line L. */
function usePreviewRows(rows: ArcherRow[] | null, config: EventConfig, preview: Preview | null): ArcherRow[] | null {
  const lineIndex = preview?.lineIndex
  const end = preview?.end
  return useMemo(() => {
    if (!rows || lineIndex === undefined || end === undefined) return rows
    const lines = config.lines.length > 0 ? config.lines : deriveLines(rows)
    return cutAt(rows, lines, lineIndex, end)
  }, [rows, config.lines, lineIndex, end])
}

function Podiums({ divisions, config, embedded }: { divisions: DivisionView[]; config: EventConfig; embedded: boolean }) {
  const Tag = embedded ? 'h3' : 'h2'
  // Several boards can share a page (2022), so the heading id carries the tournament.
  const headingId = `podiums-heading-${config.slug}`
  const shown = divisions.filter((division) => division.shot > 0)
  if (shown.length === 0) return <p className="muted">Podiums appear here once scoring starts.</p>
  const allFinal = shown.every((division) => division.status === 'final')
  return (
    <section aria-labelledby={headingId}>
      <Tag id={headingId} className="section-title">
        {allFinal ? 'Final podiums' : 'Podiums so far'}
      </Tag>
      <div className="pod-grid">
        {shown.map((division) => (
          <PodiumCard
            key={division.name}
            division={division}
            href={divisionHref(config, division.display.slug)}
            titleTag={embedded ? 'h4' : 'h3'}
          />
        ))}
      </div>
    </section>
  )
}

function PreviewBanner({ preview, view }: { preview: Preview; view: EventView }) {
  const label = view.lines[preview.lineIndex]?.label ?? `line ${preview.lineIndex}`
  return (
    <p className="banner banner-preview">
      Preview: scores as they stood at end {preview.end} of {label}. Not live.
    </p>
  )
}

/** Said instead of the board until scores arrive, so an empty board is never mistaken for a real one. */
function loadingText(config: EventConfig, state: FetchState): string {
  if (!state.error) return 'Loading scores…'
  return config.live ? 'Waiting for the scoreboard…' : "Couldn't load these results. Reload to try again."
}

/**
 * Lines, search and podiums. Until the first rows arrive (or an unconfigured event has none to
 * wait for) there is nothing true to show: five Upcoming lines would be false for a finished event.
 */
function Board({ config, state, view, embedded }: { config: EventConfig; state: FetchState; view: EventView; embedded: boolean }) {
  if (!isUnconfigured(config) && state.rows === null) return <p className="muted">{loadingText(config, state)}</p>
  // Several boards on one page (2022) would repeat the same landmark names, so each says which section it is.
  const scope = embedded ? config.sectionLabel : null
  return (
    <>
      {view.lines.length > 0 && <LineStrip lines={view.lines} scope={scope} />}
      <ArcherSearch view={view} config={config} scope={scope} />
      <Podiums divisions={view.divisions} config={config} embedded={embedded} />
    </>
  )
}

/** Whether every line has closed, so the page can stop asking EOS for updates so often. */
function allLinesFinal(view: EventView): boolean {
  return view.lines.length > 0 && view.lines.every((line) => line.status === 'final')
}

/** Its own title: the event name as the page heading, or (inside a multi-tournament page) the section's label as a subheading. */
function Heading({ config, embedded }: { config: EventConfig; embedded: boolean }) {
  if (embedded) return <h2 className="page-title">{config.sectionLabel ?? config.name}</h2>
  return (
    <>
      <h1 className="page-title">{config.name}</h1>
      <p className="page-meta">{config.dates} · PEAP, College Station</p>
    </>
  )
}

/**
 * The home page body for one event: line strip, archer search and a podium card per division.
 * `embedded` is for one of several boards on a page that already has its own h1 (the two 2022 tournaments).
 * Reads `?preview=`, so whoever renders it needs a Suspense boundary above it.
 */
export function HomeView({ config, note, embedded = false }: { config: EventConfig; note: string | null; embedded?: boolean }) {
  const [idle, setIdle] = useState(false)
  const state = useEventData(config, idle)
  const preview = parsePreview(useSearchParams().get('preview'))
  const rows = usePreviewRows(state.rows, config, preview)
  const view = useMemo(() => buildEventView(rows ?? [], config), [rows, config])
  const finished = allLinesFinal(view)
  useEffect(() => setIdle(finished), [finished])
  const banner = note ?? (isUnconfigured(config) ? SCORING_SOON_NOTE : null)

  return (
    <div className="page">
      <Heading config={config} embedded={embedded} />
      {!isUnconfigured(config) && <StatusLine config={config} state={state} />}
      {preview && <PreviewBanner preview={preview} view={view} />}
      {banner && <p className="banner">{banner}</p>}
      <Board config={config} state={state} view={view} embedded={embedded} />
    </div>
  )
}
