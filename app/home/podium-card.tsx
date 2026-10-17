import Link from 'next/link'
import type { DivisionView } from '@/lib/status'
import { DivisionBadge } from './division-badge'

const SHOOT_OFF_NOTE = 'Same score, 10s and 9s: shoot-off needed'

function footerLines(division: DivisionView): string[] {
  const { remaining, count, shot, tieFor } = division
  const lines = [remaining > 0 ? `${remaining} of ${count} still to shoot` : `All ${shot} have shot`]
  return tieFor === null ? lines : [...lines, SHOOT_OFF_NOTE]
}

/** The top three so far in one division, tied archers sharing a medal. Tapping the card opens the full board. */
export function PodiumCard({ division, href, titleTag: Title }: { division: DivisionView; href: string; titleTag: 'h3' | 'h4' }) {
  return (
    <article className="pod">
      <Title className="pod-title">
        <Link href={href} className="pod-link">
          {division.display.label}
        </Link>
      </Title>
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
      {footerLines(division).map((text) => (
        <p key={text} className="pod-foot">
          {text}
        </p>
      ))}
    </article>
  )
}
