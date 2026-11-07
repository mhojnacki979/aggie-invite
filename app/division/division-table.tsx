'use client'

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_ROUNDS, archerMeta, arrowAverage, formatAverage, roundCountOf, roundHeadings, roundScore, sortRows } from '@/lib/board-columns'
import type { BoardSort } from '@/lib/board-columns'
import type { DivisionView, LineView } from '@/lib/status'
import type { ArcherRow } from '@/lib/types'
import type { Favorites } from '@/lib/use-favorites'
import { FavoriteStar } from '../components/favorite-star'

const NO_SCORE = '—'

interface RowProps {
  row: ArcherRow
  line: LineView | undefined
  roundCount: number
  highlighted: boolean
  pending: boolean
  unstartedAsZero: boolean
  favorites: Favorites | null
  onOpen: (row: ArcherRow) => void
}

function rowClass(started: boolean, highlighted: boolean, pending: boolean): string {
  return ['dv-row', started ? 'dv-tappable' : 'dv-muted', highlighted && 'dv-target', pending && 'dv-pending']
    .filter(Boolean)
    .join(' ')
}

interface CellProps {
  row: ArcherRow
  line: LineView | undefined
  started: boolean
  pending: boolean
  favorites: Favorites | null
}

function ArcherCell({ row, line, started, pending, favorites }: CellProps) {
  const content = (
    <>
      <span className="dv-name">{row.name}</span>
      <span className="dv-meta">{archerMeta(row, line)}</span>
    </>
  )
  // The whole row takes the tap (see BoardRow); this button is what keyboards and screen readers reach.
  const name = started ? (
    <button type="button" className="dv-open" aria-disabled={pending} aria-haspopup="dialog">
      {content}
    </button>
  ) : (
    content
  )
  if (!favorites) return <td className="dv-archer">{name}</td>
  // With the star in front, the name and meta stay stacked in their own box.
  return (
    <td className="dv-archer">
      <span className="dv-fav">
        <FavoriteStar name={row.name} on={favorites.has(row.shooterId)} onToggle={() => favorites.toggle(row.shooterId)} />
        <span className="dv-who">{name}</span>
      </span>
    </td>
  )
}

function BoardRow({ row, line, roundCount, highlighted, pending, unstartedAsZero, favorites, onOpen }: RowProps) {
  const started = row.arrowsShot > 0
  const blank = unstartedAsZero ? 0 : NO_SCORE
  const score = (value: number | null | undefined): string | number => (started ? (value ?? NO_SCORE) : blank)
  const tap = started ? () => (pending ? undefined : onOpen(row)) : undefined
  const average = arrowAverage(row)
  const ref = useRef<HTMLTableRowElement>(null)
  // Arriving from a search hit: bring that archer's row into view once, not on every poll.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: 'center' })
  }, [highlighted])
  return (
    <tr ref={ref} className={rowClass(started, highlighted, pending)} onClick={tap} aria-current={highlighted ? 'true' : undefined}>
      <td className="num dv-rank">{started ? score(row.rank) : NO_SCORE}</td>
      <ArcherCell row={row} line={line} started={started} pending={pending} favorites={favorites} />
      {Array.from({ length: roundCount }, (_, index) => (
        <td key={index} className="num dv-round">
          {score(roundScore(row, index, roundCount))}
        </td>
      ))}
      <td className="num dv-total">{score(row.total)}</td>
      <td className="num dv-avg">{average === null ? NO_SCORE : formatAverage(average)}</td>
      <td className="num dv-tens">{score(row.tens)}</td>
      <td className="num dv-nines">{score(row.nines)}</td>
    </tr>
  )
}

const SORTS: { value: BoardSort; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'average', label: 'Average' },
]

/** The table's classes; division.css uses them to choose which columns a phone has room for. */
function tableClass(roundCount: number, sort: BoardSort): string {
  return ['dv-table', roundCount > DEFAULT_ROUNDS && 'dv-many-rounds', sort === 'average' && 'dv-by-average'].filter(Boolean).join(' ')
}

/** Score is the official standings; Average reorders the same board by points per arrow, with # still the official place. */
function SortSwitch({ sort, onChange }: { sort: BoardSort; onChange: (sort: BoardSort) => void }) {
  return (
    <div className="dv-sort">
      <div className="dv-sort-group" role="group" aria-label="Sort the board">
        <span className="dv-sort-label">Sort by</span>
        {SORTS.map((option) => (
          <button key={option.value} type="button" className="dv-sort-btn" aria-pressed={sort === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {/* Always rendered, so a screen reader announces the change when the board re-sorts. */}
      <p className="dv-sort-note" aria-live="polite">
        {sort === 'average' ? 'Sorted by arrow average. # is still the official place.' : ''}
      </p>
    </div>
  )
}

interface TableProps {
  division: DivisionView
  lineByShooter: Record<string, LineView>
  highlightId: string | null
  pending: ReadonlySet<string>
  /** A live event shows an archer who hasn't shot at 0; a finished year keeps the dash for no-shows. */
  unstartedAsZero: boolean
  /** Set on a live event: a star on each row adds the archer to "Your archers" on the home page. */
  favorites: Favorites | null
  onOpen: (row: ArcherRow) => void
}

/**
 * The full board for one division. Under 480px 9s drops out, and so do the round columns when there
 * are more than two of them (the 2022 Double FITA's four don't fit a phone). A phone shows Avg only
 * while the board is sorted by average, in place of 10s. See division.css.
 */
export function DivisionTable({ division, lineByShooter, highlightId, pending, unstartedAsZero, favorites, onOpen }: TableProps) {
  const roundCount = roundCountOf(division.rows)
  const [sort, setSort] = useState<BoardSort>('score')
  const rows = sortRows(division.rows, sort)
  return (
    <>
      <SortSwitch sort={sort} onChange={setSort} />
      <div className="dv-scroll">
        <table className={tableClass(roundCount, sort)}>
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
              <th scope="col" className="dv-avg" aria-sort={sort === 'average' ? 'descending' : undefined}>
                Avg
              </th>
              <th scope="col" className="dv-tens">
                10s
              </th>
              <th scope="col" className="dv-nines">
                9s
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BoardRow
                key={row.shooterId}
                row={row}
                line={lineByShooter[row.shooterId]}
                roundCount={roundCount}
                highlighted={row.shooterId === highlightId}
                unstartedAsZero={unstartedAsZero}
                pending={pending.has(row.shooterId)}
                favorites={favorites}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
