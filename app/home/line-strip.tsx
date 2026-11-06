import type { LineStatus, LineView } from '@/lib/status'
import { archerCount } from './format'

/** The 60-arrow Aggie Invitational is 20 ends of 3 arrows. */
const ENDS_PER_LINE = 20

const PILL_TEXT: Record<LineStatus, string> = {
  upcoming: 'Upcoming',
  shooting: 'Shooting now',
  final: 'Final',
}

interface LineCardProps {
  line: LineView
  reserveTag: boolean
  selected: boolean
  onSelect?: (key: string) => void
}

function LineCard({ line, reserveTag, selected, onSelect }: LineCardProps) {
  const end = Math.min(line.endsShot, ENDS_PER_LINE)
  const body = (
    <>
      <b className="line-label">{line.label}</b>
      {/* When any card in the strip has a tag, the rest keep an empty row so every status pill sits level. */}
      {line.tag ? <span className="line-tag">{line.tag}</span> : reserveTag && <span className="line-tag" aria-hidden="true">&nbsp;</span>}
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
    </>
  )
  // A live event's lines are buttons: picking one shows only that line's archers below.
  return (
    <li className={`line line-${line.status}${selected ? ' line-selected' : ''}`}>
      {onSelect ? (
        <button type="button" className="line-btn" aria-pressed={selected} onClick={() => onSelect(line.key)}>
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  )
}

/** The shooting lines in order, each with its state: upcoming, shooting now, or final. */
export function LineStrip({
  lines,
  scope = null,
  selected = null,
  onSelect,
}: {
  lines: LineView[]
  scope?: string | null
  selected?: string | null
  onSelect?: (key: string) => void
}) {
  const reserveTag = lines.some((line) => line.tag)
  return (
    <>
      <ul className={onSelect ? 'lines lines-pickable' : 'lines'} aria-label={scope ? `Shooting lines: ${scope}` : 'Shooting lines'}>
        {lines.map((line) => (
          <LineCard key={line.key} line={line} reserveTag={reserveTag} selected={line.key === selected} onSelect={onSelect} />
        ))}
      </ul>
      {onSelect && <p className="line-hint">Tap a time to see only the archers shooting it.</p>}
    </>
  )
}
