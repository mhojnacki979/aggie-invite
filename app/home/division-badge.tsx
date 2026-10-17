import { badgesFor } from '@/lib/settled'
import type { BadgeKind } from '@/lib/settled'
import type { DivisionView } from '@/lib/status'
import { ordinal } from './format'

const CLASSES: Record<BadgeKind, string> = { tie: 'badge-tie', final: 'badge-final', provisional: 'badge-prov' }

function labelFor(kind: BadgeKind, division: DivisionView): string {
  if (kind === 'tie') return `Tie for ${ordinal(division.tieFor ?? 0)}`
  return kind === 'final' ? 'Final' : 'Provisional'
}

/** Says whether a division's result is settled; the rule itself lives in `badgesFor`. */
export function DivisionBadge({ division }: { division: DivisionView }) {
  return (
    <span className="badges">
      {badgesFor(division).map((kind) => (
        <span key={kind} className={`badge ${CLASSES[kind]}`}>
          {labelFor(kind, division)}
        </span>
      ))}
    </span>
  )
}
