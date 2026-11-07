'use client'

import { baleStatus } from '@/lib/checkin'
import type { Bale, BaleStatus } from '@/lib/checkin'

const STATUS_TEXT: Record<BaleStatus, string> = {
  shooting: 'still shooting',
  ready: 'ready to check',
  checked: 'checked',
}

interface GridProps {
  bales: Bale[]
  isChecked: (bale: number) => boolean
  selected: number | null | undefined
  onSelect: (bale: number | null) => void
}

/** One tile per bale for the chosen time: grey still shooting, tan ready to check, green checked. */
export function BaleGrid({ bales, isChecked, selected, onSelect }: GridProps) {
  return (
    <div className="ck-grid" role="group" aria-label="Bales">
      {bales.map((bale) => {
        if (bale.number === null) {
          return (
            <button
              key="none"
              type="button"
              className="ck-tile ck-none"
              aria-pressed={selected === null}
              onClick={() => onSelect(null)}
            >
              No bale
            </button>
          )
        }
        const status = baleStatus(bale, isChecked(bale.number))
        return (
          <button
            key={bale.number}
            type="button"
            className={`ck-tile ck-${status}`}
            aria-pressed={selected === bale.number}
            aria-label={`Bale ${bale.number}, ${STATUS_TEXT[status]}`}
            onClick={() => onSelect(bale.number)}
          >
            {bale.number}
          </button>
        )
      })}
    </div>
  )
}
