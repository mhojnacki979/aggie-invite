'use client'

import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { ArcherRow, EndScore, Scorecard } from '@/lib/types'
import './scorecard-modal.css'

/** What the modal is showing right now. `busy` is EOS answering 429. */
export type CardView =
  | { kind: 'loading' }
  | { kind: 'ready'; card: Scorecard | null }
  | { kind: 'error'; busy: boolean }

export const BUSY_TEXT = 'Scores are busy right now. Tap to try again.'
export const ERROR_TEXT = "Couldn't load this scorecard. Try again."
export const LOADING_TEXT = 'Loading scorecard…'
const EMPTY_TEXT = 'No arrows shot yet.'

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

/** Escape closes; focus moves in on open and back to whatever opened it on close; the page behind stays put. */
function useDialogBehavior(onClose: () => void): RefObject<HTMLButtonElement | null> {
  const closeRef = useRef<HTMLButtonElement>(null)
  // Read through a ref so a new onClose each render does not re-run the effect and re-grab focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])
  return closeRef
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
  const closeRef = useDialogBehavior(onClose)
  return (
    <div
      className="sc-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sc-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button ref={closeRef} type="button" className="sc-close" onClick={onClose} aria-label="Close scorecard">
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
        <Body view={view} onRetry={onRetry} />
      </div>
    </div>
  )
}
