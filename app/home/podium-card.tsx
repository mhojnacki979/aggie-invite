import Link from 'next/link'
import { archerMeta } from '@/lib/board-columns'
import { footerLines } from '@/lib/settled'
import type { DivisionView, LineView } from '@/lib/status'
import type { ArcherRow } from '@/lib/types'
import { DivisionBadge } from './division-badge'

type LineByShooter = Record<string, LineView>

/**
 * Before anyone in the division has shot: its archers A–Z at 0, each with their line and bale.
 * No medals or badge, since nothing is decided.
 */
function StartList({ division, lineByShooter }: { division: DivisionView; lineByShooter: LineByShooter }) {
  const rows = [...division.rows].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <ul className="pod-rows">
      {rows.map((row) => (
        <li key={row.shooterId} className="pod-row">
          <span className="medal" aria-hidden="true" />
          <span className="pod-name">
            {row.name}
            <span className="pod-meta">{archerMeta(row, lineByShooter[row.shooterId])}</span>
          </span>
          <span className="num">0</span>
        </li>
      ))}
    </ul>
  )
}

/** One archer in a line-filtered card: their place in the division once they have shot, else blank at 0. */
function LineRow({ row }: { row: ArcherRow }) {
  const shot = row.arrowsShot > 0
  return (
    <li className="pod-row">
      <span className={shot && row.rank <= 3 ? `medal medal-${row.rank}` : 'medal'} aria-hidden={shot ? undefined : true}>
        {shot ? row.rank : ''}
      </span>
      <span className="pod-name">
        {row.name}
        <span className="pod-meta">{row.target}</span>
      </span>
      <span className="num">{shot ? row.total : 0}</span>
    </li>
  )
}

/** With a line picked: the division's archers on that line, those who have shot by place, then the rest A–Z. */
function LineList({ division, lineByShooter, lineKey }: { division: DivisionView; lineByShooter: LineByShooter; lineKey: string }) {
  const rows = division.rows.filter((row) => lineByShooter[row.shooterId]?.key === lineKey)
  const shot = rows.filter((row) => row.arrowsShot > 0).sort((a, b) => a.rank - b.rank)
  const waiting = rows.filter((row) => row.arrowsShot === 0).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <ul className="pod-rows">
      {[...shot, ...waiting].map((row) => (
        <LineRow key={row.shooterId} row={row} />
      ))}
    </ul>
  )
}

/** The top three so far, tied archers sharing a medal. */
function Podium({ division }: { division: DivisionView }) {
  return (
    <>
      <DivisionBadge division={division} />
      <ol className="pod-rows">
        {division.podium.map((row) => (
          <li key={row.shooterId} className="pod-row">
            <span className={`medal medal-${Math.min(row.rank, 3)}`}>{row.rank}</span>
            <span className="pod-name">{row.name}</span>
            <span className="num">{row.total}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

function CardBody({ division, lineByShooter, lineKey }: { division: DivisionView; lineByShooter: LineByShooter; lineKey: string | null }) {
  if (lineKey !== null) {
    return (
      <>
        {division.shot > 0 && <DivisionBadge division={division} />}
        <LineList division={division} lineByShooter={lineByShooter} lineKey={lineKey} />
      </>
    )
  }
  if (division.shot === 0) return <StartList division={division} lineByShooter={lineByShooter} />
  return <Podium division={division} />
}

/**
 * One division: its podium, its start list before scoring, or (with a line picked) that line's archers.
 * Tapping the title opens the full board.
 */
export function PodiumCard({
  division,
  lineByShooter,
  lineKey,
  href,
  titleTag: Title,
}: {
  division: DivisionView
  lineByShooter: LineByShooter
  lineKey: string | null
  href: string
  titleTag: 'h3' | 'h4'
}) {
  return (
    <article className="pod">
      <Title className="pod-title">
        <Link href={href} className="pod-link">
          {division.display.label}
        </Link>
      </Title>
      <CardBody division={division} lineByShooter={lineByShooter} lineKey={lineKey} />
      {/* The footer counts the whole division, which a line-filtered card isn't showing. */}
      {(lineKey === null ? footerLines(division) : []).map((text) => (
        <p key={text} className="pod-foot">
          {text}
        </p>
      ))}
    </article>
  )
}
