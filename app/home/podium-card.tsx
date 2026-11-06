import Link from 'next/link'
import { archerMeta } from '@/lib/board-columns'
import { footerLines } from '@/lib/settled'
import type { DivisionView, LineView } from '@/lib/status'
import { DivisionBadge } from './division-badge'

/**
 * Before anyone in the division has shot: its archers A–Z at 0, each with their line and bale.
 * No medals or badge, since nothing is decided.
 */
function StartList({ division, lineByShooter }: { division: DivisionView; lineByShooter: Record<string, LineView> }) {
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

/** The top three so far in one division, tied archers sharing a medal. Tapping the card opens the full board. */
export function PodiumCard({
  division,
  lineByShooter,
  href,
  titleTag: Title,
}: {
  division: DivisionView
  lineByShooter: Record<string, LineView>
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
      {division.shot === 0 ? (
        <StartList division={division} lineByShooter={lineByShooter} />
      ) : (
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
      )}
      {footerLines(division).map((text) => (
        <p key={text} className="pod-foot">
          {text}
        </p>
      ))}
    </article>
  )
}
