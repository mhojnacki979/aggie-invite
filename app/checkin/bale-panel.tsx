'use client'

import { DEFAULT_ROUNDS, roundScore } from '@/lib/board-columns'
import { baleStatus } from '@/lib/checkin'
import type { Bale, BaleSeat } from '@/lib/checkin'
import type { BaleCheck } from '@/lib/checkin-store'
import { isDone } from '@/lib/status'
import type { ArcherRow } from '@/lib/types'

const NO_SCORE = '—'
const ARROWS_PER_END = 3
const CONFIRM_UNFINISHED = 'Not everyone on this bale has finished. Mark it checked anyway?'

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function endsNote(row: ArcherRow): string | null {
  if (isDone(row)) return null
  return `End ${Math.floor(row.arrowsShot / ARROWS_PER_END)} of ${Math.floor(row.arrowsDue / ARROWS_PER_END)}`
}

function SeatRow({ seat, onOpen }: { seat: BaleSeat; onOpen: (row: ArcherRow) => void }) {
  const { row } = seat
  const roundCount = row.rounds.length > 0 ? row.rounds.length : DEFAULT_ROUNDS
  const round = (index: number): string | number => roundScore(row, index, roundCount) ?? NO_SCORE
  const note = endsNote(row)
  return (
    <tr className="ck-seat" onClick={() => onOpen(row)}>
      <td className="ck-pos">{seat.position || NO_SCORE}</td>
      <td className="ck-who">
        <button type="button" className="ck-open" aria-haspopup="dialog">
          <span className="ck-name">{row.name}</span>
          <span className="ck-meta">{seat.division.display.label}</span>
          {note && <span className="ck-note">{note}</span>}
        </button>
      </td>
      <td className="num">{round(0)}</td>
      <td className="num">{round(1)}</td>
      <td className="num ck-total">{row.total}</td>
      <td className="num">{row.tens}</td>
      <td className="num">{row.nines}</td>
    </tr>
  )
}

function subtitle(bale: Bale, lineLabel: string): string {
  const done = bale.seats.filter((seat) => isDone(seat.row)).length
  const count = bale.seats.length
  const progress = done === count ? `all ${count} archers finished` : `${done} of ${count} finished`
  return `${lineLabel} · ${progress}`
}

interface CheckProps {
  bale: Bale & { number: number }
  check: BaleCheck | undefined
  onCheck: () => void
  onUncheck: () => void
}

function CheckControl({ bale, check, onCheck, onUncheck }: CheckProps) {
  if (check) {
    return (
      <p className="ck-checked">
        Checked by {check.checkedBy} at {clock(check.checkedAt)} ·{' '}
        <button type="button" className="ck-undo" onClick={onUncheck}>
          Undo
        </button>
      </p>
    )
  }
  const confirmFirst = baleStatus(bale, false) !== 'ready'
  const mark = (): void => {
    if (!confirmFirst || window.confirm(CONFIRM_UNFINISHED)) onCheck()
  }
  return (
    <button type="button" className="ck-primary ck-mark" onClick={mark}>
      ✓ Mark bale {bale.number} checked
    </button>
  )
}

interface PanelProps {
  bale: Bale
  lineLabel: string
  check: BaleCheck | undefined
  onCheck: () => void
  onUncheck: () => void
  onOpen: (row: ArcherRow) => void
}

/** The selected bale's archers in letter order, their scores, and the check-off. */
export function BalePanel({ bale, lineLabel, check, onCheck, onUncheck, onOpen }: PanelProps) {
  const number = bale.number
  return (
    <section className="ck-panel" aria-labelledby="ck-bale-heading">
      <h2 id="ck-bale-heading" className="ck-bale-title">
        {number === null ? 'No bale' : `Bale ${number}`}
      </h2>
      <p className="ck-sub">
        {number === null ? `${lineLabel} · archers EOS didn't place on a bale` : `${subtitle(bale, lineLabel)} · tap an archer for their scorecard`}
      </p>
      <div className="ck-scroll">
        <table className="ck-table">
          <thead>
            <tr>
              <th scope="col" aria-label="Position" />
              <th scope="col" className="ck-who">
                Archer
              </th>
              <th scope="col">1st 30</th>
              <th scope="col">2nd 30</th>
              <th scope="col">Total</th>
              <th scope="col">10s</th>
              <th scope="col">9s</th>
            </tr>
          </thead>
          <tbody>
            {bale.seats.map((seat) => (
              <SeatRow key={seat.row.shooterId} seat={seat} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      {number !== null && <CheckControl bale={{ ...bale, number }} check={check} onCheck={onCheck} onUncheck={onUncheck} />}
    </section>
  )
}
