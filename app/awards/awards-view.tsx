'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CURRENT_EVENT, SCORING_SOON_NOTE } from '@/config/event'
import { awardsOrder, podiumSlots, slideFromHash, slideHash, slideMode, stepIndex } from '@/lib/awards'
import type { PlaceSlot } from '@/lib/awards'
import { buildEventView } from '@/lib/status'
import type { DivisionView } from '@/lib/status'
import { isUnconfigured, useEventData } from '@/lib/use-event-data'
import { makeInert } from '../components/inert'
import { ordinal } from '../home/format'
import './awards.css'

const SHOOT_OFF_NOTE = 'Same score, 10s and 9s: shoot-off needed'
/** Left to right on screen: 2nd, 1st, 3rd, the way a podium stands. */
const SCREEN_ORDER = [1, 0, 2] as const

function PlaceBody({ slot }: { slot: PlaceSlot }) {
  if (slot.kind === 'covered') return <p className="aw-hold">Pending shoot-off</p>
  if (slot.kind === 'empty') return <p className="aw-hold">No archer</p>
  return (
    <>
      {slot.kind === 'tie' && <p className="aw-tie-label">Tie for {ordinal(slot.place)}</p>}
      <ul className="aw-archers">
        {slot.archers.map((row) => (
          <li key={row.shooterId} className="aw-archer">
            <span className="aw-name">{row.name}</span>
            <span className="aw-score num">{row.total}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Four or more archers on one card need a smaller type step; `--n` lets the type shrink with the count. */
const MANY_ARCHERS = 4

function PlaceCard({ slot }: { slot: PlaceSlot }) {
  const count = slot.archers.length
  const many = count >= MANY_ARCHERS
  const style: CSSProperties & { '--n'?: number } = many ? { '--n': count } : {}
  return (
    <li className={`aw-place aw-place-${slot.place} aw-${slot.kind}${many ? ' aw-many' : ''}`} style={style}>
      <span className={`aw-medal aw-medal-${slot.place}`}>{slot.place}</span>
      <PlaceBody slot={slot} />
    </li>
  )
}

function Podium({ division }: { division: DivisionView }) {
  const slots = podiumSlots(division)
  const hasTie = division.tieFor !== null
  return (
    <>
      <ol className="aw-podium">
        {SCREEN_ORDER.map((index) => {
          const slot = slots[index]
          return slot ? <PlaceCard key={slot.place} slot={slot} /> : null
        })}
      </ol>
      {hasTie && <p className="aw-note aw-note-tie">{SHOOT_OFF_NOTE}</p>}
    </>
  )
}

/** A division still being shot is never shown as a podium: standings that can change are not awards. */
function Provisional({ division }: { division: DivisionView }) {
  return (
    <div className="aw-provisional">
      <p className="aw-prov-title">Provisional</p>
      <p className="aw-note">
        {division.remaining} of {division.count} still to shoot
      </p>
      <p className="aw-hold">Not ready to announce</p>
    </div>
  )
}

function Slide({ division, index, total }: { division: DivisionView; index: number; total: number }) {
  return (
    <section className="aw-slide" aria-live="polite">
      <p className="aw-counter">
        Award {index + 1} of {total}
      </p>
      <h1 className="aw-title">{division.display.label}</h1>
      {slideMode(division) === 'podium' ? <Podium division={division} /> : <Provisional division={division} />}
    </section>
  )
}

/** Moves between slides with a clicker (arrows, space, page keys) or a click, and returns the current one. */
function useStepper(total: number): [number, () => void] {
  // Ceremony only mounts once scores have loaded on the client, so reading the hash here cannot mismatch the server render.
  const [index, setIndex] = useState(() => slideFromHash(window.location.hash, total))
  // Keep the place in the URL, so a reload resumes the same slide.
  useEffect(() => window.history.replaceState(null, '', slideHash(index)), [index])
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === ' ' || event.key.startsWith('Page')) event.preventDefault()
      // Functional update: two keydowns in one tick (a bouncing clicker) each move from the latest slide.
      setIndex((current) => stepIndex(current, total, event.key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])
  // A division list that shrinks (a fresh poll) must not leave the index past the end.
  useEffect(() => setIndex((current) => Math.min(current, Math.max(0, total - 1))), [total])
  const forward = useCallback(() => setIndex((current) => stepIndex(current, total, 'ArrowRight')), [total])
  return [index, forward]
}

function Message({ text }: { text: string }) {
  return (
    <div className="aw-screen">
      <p className="aw-message">{text}</p>
    </div>
  )
}

function Ceremony({ divisions }: { divisions: DivisionView[] }) {
  const [index, forward] = useStepper(divisions.length)
  const division = divisions[index]
  if (!division) return <Message text="No scores to award yet" />
  return (
    <div className="aw-screen" onClick={forward}>
      <Slide division={division} index={index} total={divisions.length} />
      <p className="aw-foot">{CURRENT_EVENT.name}</p>
    </div>
  )
}

/** The site's header and footer sit behind the overlay; keep Tab and a stray Enter from reaching their links. */
function useInertChrome(): void {
  useEffect(() => makeInert(Array.from(document.querySelectorAll('.site-header, .site-footer'))), [])
}

/**
 * The Sunday awards ceremony: one division per slide, projected and stepped through with a clicker.
 * It covers the site's header and footer, and nothing links here; you reach it by typing the URL.
 */
export function AwardsView() {
  useInertChrome()
  const state = useEventData(CURRENT_EVENT)
  const divisions = useMemo(
    () => awardsOrder(buildEventView(state.rows ?? [], CURRENT_EVENT)),
    [state.rows],
  )
  if (isUnconfigured(CURRENT_EVENT)) return <Message text={SCORING_SOON_NOTE} />
  if (state.rows === null) return <Message text={state.error ? 'Waiting for the scoreboard…' : 'Loading scores…'} />
  return <Ceremony divisions={divisions} />
}
