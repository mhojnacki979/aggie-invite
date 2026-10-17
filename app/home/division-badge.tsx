import type { DivisionView } from '@/lib/status'
import { ordinal } from './format'

/**
 * Says whether a division's result is settled. A tie wins the badge, since it needs a shoot-off,
 * but a tie in a division still shooting also keeps the Provisional badge: a podium that can
 * still change must never read as settled.
 */
export function DivisionBadge({ division }: { division: DivisionView }) {
  const { tieFor, status } = division
  return (
    <span className="badges">
      {tieFor !== null && <span className="badge badge-tie">Tie for {ordinal(tieFor)}</span>}
      {tieFor === null && status === 'final' && <span className="badge badge-final">Final</span>}
      {status === 'provisional' && <span className="badge badge-prov">Provisional</span>}
    </span>
  )
}
