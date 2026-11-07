'use client'

import { useEffect, useMemo, useState } from 'react'
import { CURRENT_EVENT } from '@/config/event'
import { balesForLine, defaultLineKey, lineProgress } from '@/lib/checkin'
import type { Bale } from '@/lib/checkin'
import { onAuthChange, signOut, supabaseStore } from '@/lib/checkin-supabase'
import { buildEventView } from '@/lib/status'
import type { EventView, LineView } from '@/lib/status'
import type { ArcherRow } from '@/lib/types'
import { useEventData } from '@/lib/use-event-data'
import { ScorecardModal } from '../components/scorecard-modal'
import { useScorecard } from '../division/use-scorecard'
import { BaleGrid } from './bale-grid'
import { BalePanel } from './bale-panel'
import { SignIn } from './sign-in'
import { useBaleChecks } from './use-bale-checks'
import type { BaleChecks } from './use-bale-checks'
import './checkin.css'

const config = CURRENT_EVENT

function lineText(line: LineView): string {
  return line.tag ? `${line.label} · ${line.tag}` : line.label
}

function TopBar() {
  return (
    <div className="ck-bar">
      <h1 className="ck-title">Aggie Invitational · Score check-in</h1>
      <span className="ck-who-am-i">
        Signed in as crew ·{' '}
        <button type="button" className="ck-link" onClick={() => void signOut()}>
          Sign out
        </button>
      </span>
    </div>
  )
}

function Progress({ bales, lineKey, checks }: { bales: Bale[]; lineKey: string; checks: BaleChecks }) {
  const checked = new Set(bales.flatMap((bale) => (bale.number !== null && checks.checked(lineKey, bale.number) ? [bale.number] : [])))
  const p = lineProgress(bales, checked)
  return (
    <p className="ck-progress">
      <b>
        {p.checked} of {p.total}
      </b>{' '}
      bales checked · {p.ready} ready · {p.shooting} still shooting
    </p>
  )
}

function Legend() {
  return (
    <p className="ck-legend" aria-hidden="true">
      <span className="ck-key ck-shooting" />
      Still shooting <span className="ck-key ck-ready" />
      Ready to check <span className="ck-key ck-checked" />
      Checked
    </p>
  )
}

function cardSubtitle(row: ArcherRow, view: EventView): string {
  const division = view.divisions.find((item) => item.rows.some((r) => r.shooterId === row.shooterId))
  const line = view.lineByShooter[row.shooterId]
  const parts = [division?.display.label, line?.label, row.target ? `Target ${row.target}` : undefined]
  return parts.filter((part): part is string => part !== undefined).join(' · ')
}

/**
 * Which time and bale are picked. The time opens on the one shooting now and then stays put: when the
 * next line starts shooting, the crew mid-way through checking a finished time must not be moved off it.
 */
function useSelection(view: EventView, loaded: boolean) {
  const [picked, setPicked] = useState<string | null>(null)
  const [baleNumber, setBaleNumber] = useState<number | null | undefined>(undefined)
  const fallback = defaultLineKey(view)
  // Pin only once scores have arrived: before that every line looks unstarted and the first would win.
  useEffect(() => {
    if (loaded && picked === null && fallback !== null) setPicked(fallback)
  }, [loaded, picked, fallback])
  const lineKey = picked ?? fallback
  const bales = useMemo(() => (lineKey ? balesForLine(view, lineKey) : []), [view, lineKey])
  return {
    lineKey,
    line: view.lines.find((item) => item.key === lineKey),
    bales,
    baleNumber,
    bale: baleNumber === undefined ? undefined : bales.find((item) => item.number === baleNumber),
    pickLine: (key: string): void => {
      setPicked(key)
      setBaleNumber(undefined)
    },
    pickBale: setBaleNumber,
  }
}

type Selection = ReturnType<typeof useSelection>

function Controls({ view, selection, checks }: { view: EventView; selection: Selection; checks: BaleChecks }) {
  return (
    <div className="ck-controls">
      <label className="ck-time">
        <span className="ck-sr">Shooting time</span>
        <select value={selection.lineKey ?? ''} onChange={(event) => selection.pickLine(event.target.value)}>
          {view.lines.map((item) => (
            <option key={item.key} value={item.key}>
              {lineText(item)}
            </option>
          ))}
        </select>
      </label>
      {selection.lineKey && <Progress bales={selection.bales} lineKey={selection.lineKey} checks={checks} />}
      <Legend />
    </div>
  )
}

function Workspace({ selection, checks, onOpen }: { selection: Selection; checks: BaleChecks; onOpen: (row: ArcherRow) => void }) {
  const { lineKey, line, bale, bales } = selection
  const number = bale?.number ?? null
  return (
    <div className="ck-cols">
      <BaleGrid
        bales={bales}
        isChecked={(n) => lineKey !== null && checks.checked(lineKey, n) !== undefined}
        selected={selection.baleNumber}
        onSelect={selection.pickBale}
      />
      {bale && lineKey && line ? (
        <BalePanel
          bale={bale}
          lineLabel={line.label}
          check={number === null ? undefined : checks.checked(lineKey, number)}
          onCheck={() => number !== null && void checks.check(lineKey, number)}
          onUncheck={() => number !== null && void checks.uncheck(lineKey, number)}
          onOpen={onOpen}
        />
      ) : (
        <p className="ck-panel ck-hint">{bales.length === 0 ? 'No archers on this time yet.' : 'Tap a bale to see its archers.'}</p>
      )}
    </div>
  )
}

/** The time picker, bale grid and bale panel. Only mounted once the crew is signed in. */
function Board() {
  const state = useEventData(config, false)
  const view = useMemo(() => buildEventView(state.rows ?? [], config), [state.rows])
  const checks = useBaleChecks(supabaseStore, config.tournamentId, true)
  const card = useScorecard(config)
  const selection = useSelection(view, state.rows !== null)
  // The board keeps polling behind the popup, so show the archer's latest row, not the one tapped.
  const open = card.open && (view.divisions.flatMap((d) => d.rows).find((r) => r.shooterId === card.open?.shooterId) ?? card.open)

  if (state.rows === null) return <p className="muted">{state.error ? 'Waiting for the scoreboard…' : 'Loading scores…'}</p>
  return (
    <>
      <Controls view={view} selection={selection} checks={checks} />
      {checks.error && (
        <p className="ck-error" role="alert">
          {checks.error}
        </p>
      )}
      <Workspace selection={selection} checks={checks} onOpen={card.show} />
      {open && <ScorecardModal row={open} subtitle={cardSubtitle(open, view)} view={card.view} onClose={card.close} onRetry={card.retry} />}
    </>
  )
}

/** Score check-in for the TD's table: sign in, pick the time, tap a bale, check it off. */
export function CheckinView() {
  // undefined until Supabase reports whether this browser already has a crew session.
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined)
  useEffect(() => onAuthChange(setSignedIn), [])
  if (signedIn === undefined) return null
  return (
    <div className="page ck-page">
      {signedIn ? (
        <>
          <TopBar />
          <Board />
        </>
      ) : (
        <SignIn />
      )}
    </div>
  )
}
