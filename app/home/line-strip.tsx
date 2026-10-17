import type { LineStatus, LineView } from '@/lib/status'
import { archerCount } from './format'

/** The 60-arrow Aggie Invitational is 20 ends of 3 arrows. */
const ENDS_PER_LINE = 20

const PILL_TEXT: Record<LineStatus, string> = {
  upcoming: 'Upcoming',
  shooting: 'Shooting now',
  final: 'Final',
}

function LineCard({ line }: { line: LineView }) {
  const end = Math.min(line.endsShot, ENDS_PER_LINE)
  return (
    <li className={`line line-${line.status}`}>
      <b className="line-label">{line.label}</b>
      {line.tag && <span className="line-tag">{line.tag}</span>}
      {line.archers > 0 && <span className="line-count">{archerCount(line.archers)}</span>}
      <span className="pill">{PILL_TEXT[line.status]}</span>
      {line.status === 'shooting' && (
        <>
          <span className="line-end">
            End {end} of {ENDS_PER_LINE}
          </span>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${(end / ENDS_PER_LINE) * 100}%` }} />
          </span>
        </>
      )}
    </li>
  )
}

/** The shooting lines in order, each with its state: upcoming, shooting now, or final. */
export function LineStrip({ lines }: { lines: LineView[] }) {
  return (
    <ul className="lines" aria-label="Shooting lines">
      {lines.map((line) => (
        <LineCard key={line.key} line={line} />
      ))}
    </ul>
  )
}
