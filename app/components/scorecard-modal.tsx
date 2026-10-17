'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ArcherRow, EndScore, Scorecard } from '@/lib/types'
import { makeInert } from './inert'
import './scorecard-modal.css'

/** What the modal is showing right now. `busy` is EOS answering 429. */
export type CardView =
  | { kind: 'loading' }
  | { kind: 'ready'; card: Scorecard | null }
  | { kind: 'error'; busy: boolean }

export const BUSY_TEXT = 'Scores are busy right now. Tap to try again.'
export const ERROR_TEXT = "Couldn't load this scorecard. Try again."
export const LOADING_TEXT = 'Loading scorecard…'
const EMPTY_TEXT = 'No scorecard on file for this archer.'

function Ends({ ends }: { ends: EndScore[] }) {
  return (
    <table className="sc-ends">
      <thead>
        <tr>
          <th scope="col">End</th>
          <th scope="col">Arrows</th>
          <th scope="col">Score</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {ends.map((end, index) => (
          <tr key={index}>
            <th scope="row" className="num">
              {index + 1}
            </th>
            <td className="sc-arrows">
              {end.arrows.map((arrow, i) => (
                <span key={i} className="sc-arrow">
                  {arrow}
                </span>
              ))}
            </td>
            <td className="num">{end.score}</td>
            <td className="num">{end.running}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Body({ view, onRetry }: { view: CardView; onRetry: () => void }) {
  if (view.kind === 'loading') return <p className="sc-note">{LOADING_TEXT}</p>
  if (view.kind === 'error') {
    return (
      <button type="button" className="sc-retry" onClick={onRetry}>
        {view.busy ? BUSY_TEXT : ERROR_TEXT}
      </button>
    )
  }
  if (view.card === null || view.card.ends.length === 0) return <p className="sc-note">{EMPTY_TEXT}</p>
  return <Ends ends={view.card.ends} />
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="sc-stat">
      <span className="sc-stat-label">{label}</span>
      <span className="num sc-stat-value">{value}</span>
    </div>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Tab and Shift+Tab wrap inside the dialog instead of walking out to the page behind it. */
function trapTab(event: ReactKeyboardEvent<HTMLElement>, dialog: HTMLElement): void {
  if (event.key !== 'Tab') return
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  const outside = !dialog.contains(active)
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}

interface DialogRefs {
  overlay: RefObject<HTMLDivElement | null>
  dialog: RefObject<HTMLDivElement | null>
  close: RefObject<HTMLButtonElement | null>
}

/**
 * Escape closes; focus moves in on open and back to whatever opened it on close; the page behind
 * stays put and is made inert, so neither Tab nor a screen reader can reach it.
 */
function useDialogBehavior(onClose: () => void): DialogRefs {
  const overlay = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  // Read through a ref so a new onClose each render does not re-run the effect and re-grab focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restoreBehind = makeInert(Array.from(document.body.children).filter((element) => element !== overlay.current))
    close.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      restoreBehind()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])
  return { overlay, dialog, close }
}

function announcement(view: CardView): string {
  if (view.kind === 'loading') return LOADING_TEXT
  if (view.kind === 'error') return view.busy ? BUSY_TEXT : ERROR_TEXT
  return ''
}

/**
 * Says the loading and error states aloud. The region is mounted empty and filled afterwards,
 * because screen readers announce a live region's changes, not what it held when it appeared.
 */
function Announcer({ view }: { view: CardView }) {
  const [said, setSaid] = useState('')
  const text = announcement(view)
  useEffect(() => setSaid(text), [text])
  return (
    <p className="sc-sr" role="status">
      {said}
    </p>
  )
}

interface ModalProps {
  row: ArcherRow
  /** `{division label} · {line label} · Target {target}` */
  subtitle: string
  view: CardView
  onClose: () => void
  onRetry: () => void
}

/** One archer's end-by-end scorecard over the board. Total, 10s and 9s come from the board row. */
export function ScorecardModal({ row, subtitle, view, onClose, onRetry }: ModalProps) {
  const titleId = useId()
  const refs = useDialogBehavior(onClose)
  // Rendered into <body> so the whole page (header, main, footer) can be made inert behind it.
  return createPortal(
    <div
      ref={refs.overlay}
      className="sc-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={refs.dialog}
        className="sc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => refs.dialog.current && trapTab(event, refs.dialog.current)}
      >
        <button ref={refs.close} type="button" className="sc-close" onClick={onClose} aria-label="Close scorecard">
          ×
        </button>
        <h2 id={titleId} className="sc-name">
          {row.name}
        </h2>
        <p className="sc-sub">{subtitle}</p>
        <div className="sc-stats">
          <Stat label="Total" value={row.total} />
          <Stat label="10s" value={row.tens} />
          <Stat label="9s" value={row.nines} />
        </div>
        <Announcer view={view} />
        <Body view={view} onRetry={onRetry} />
      </div>
    </div>,
    document.body,
  )
}
