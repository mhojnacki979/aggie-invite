'use client'

import { useEffect, useRef } from 'react'
import { archerMeta, roundCountOf, roundHeadings } from '@/lib/board-columns'
import type { DivisionView, LineView } from '@/lib/status'
import type { ArcherRow } from '@/lib/types'

const NO_SCORE = '—'

interface RowProps {
  row: ArcherRow
  line: LineView | undefined
  roundCount: number
  highlighted: boolean
  pending: boolean
  onOpen: (row: ArcherRow) => void
}

function rowClass(started: boolean, highlighted: boolean, pending: boolean): string {
  return ['dv-row', started ? 'dv-tappable' : 'dv-muted', highlighted && 'dv-target', pending && 'dv-pending']
    .filter(Boolean)
    .join(' ')
}

function ArcherCell({ row, line, started, pending }: { row: ArcherRow; line: LineView | undefined; started: boolean; pending: boolean }) {
  const content = (
    <>
      <span className="dv-name">{row.name}</span>
      <span className="dv-meta">{archerMeta(row, line)}</span>
    </>
  )
  // The whole row takes the tap (see BoardRow); this button is what keyboards and screen readers reach.
  return (
    <td className="dv-archer">
      {started ? (
        <button type="button" className="dv-open" aria-disabled={pending} aria-haspopup="dialog">
          {content}
        </button>
      ) : (
        content
      )}
    </td>
  )
}

function BoardRow({ row, line, roundCount, highlighted, pending, onOpen }: RowProps) {
  const started = row.arrowsShot > 0
  const score = (value: number | undefined): string | number => (started ? (value ?? NO_SCORE) : NO_SCORE)
  const tap = started ? () => (pending ? undefined : onOpen(row)) : undefined
  const ref = useRef<HTMLTableRowElement>(null)
  // Arriving from a search hit: bring that archer's row into view once, not on every poll.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center' })
  }, [highlighted])
  return (
    <tr ref={ref} className={rowClass(started, highlighted, pending)} onClick={tap} aria-current={highlighted ? 'true' : undefined}>
      <td className="num dv-rank">{score(row.rank)}</td>
      <ArcherCell row={row} line={line} started={started} pending={pending} />
      {Array.from({ length: roundCount }, (_, index) => (
        <td key={index} className="num dv-round">
          {score(row.rounds[index])}
        </td>
      ))}
      <td className="num dv-total">{score(row.total)}</td>
      <td className="num">{score(row.tens)}</td>
      <td className="num dv-nines">{score(row.nines)}</td>
    </tr>
  )
}

interface TableProps {
  division: DivisionView
  lineByShooter: Record<string, LineView>
  highlightId: string | null
  pending: ReadonlySet<string>
  onOpen: (row: ArcherRow) => void
}

/** The full board for one division. Round columns and 9s drop out under 480px (see division.css). */
export function DivisionTable({ division, lineByShooter, highlightId, pending, onOpen }: TableProps) {
  const roundCount = roundCountOf(division.rows)
  return (
    <div className="dv-scroll">
      <table className="dv-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="dv-archer">
              Archer
            </th>
            {roundHeadings(roundCount).map((heading) => (
              <th key={heading} scope="col" className="dv-round">
                {heading}
              </th>
            ))}
            <th scope="col">Total</th>
            <th scope="col">10s</th>
            <th scope="col" className="dv-nines">
              9s
            </th>
          </tr>
        </thead>
        <tbody>
          {division.rows.map((row) => (
            <BoardRow
              key={row.shooterId}
              row={row}
              line={lineByShooter[row.shooterId]}
              roundCount={roundCount}
              highlighted={row.shooterId === highlightId}
              pending={pending.has(row.shooterId)}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
