'use client'

import { useId } from 'react'
import { useRouter } from 'next/navigation'
import { listedDivisions } from '@/lib/division-options'
import type { EventView } from '@/lib/status'
import type { EventConfig } from '@/lib/types'
import { divisionHref } from './format'

interface JumpProps {
  view: EventView
  config: EventConfig
  scope?: string | null
}

/** A dropdown of the board's divisions; picking one opens that division's full board. */
export function DivisionJump({ view, config, scope = null }: JumpProps) {
  const router = useRouter()
  const selectId = useId()
  const divisions = listedDivisions(view.divisions, config.live)
  if (divisions.length === 0) return null
  return (
    <section className="search jump" aria-label={scope ? `Go to a division: ${scope}` : 'Go to a division'}>
      <label htmlFor={selectId} className="search-label">
        Go to a division
      </label>
      <select
        id={selectId}
        className="search-input jump-select"
        value=""
        onChange={(event) => {
          if (event.target.value) router.push(divisionHref(config, event.target.value))
        }}
      >
        <option value="">Pick a division</option>
        {divisions.map((division) => (
          <option key={division.display.slug} value={division.display.slug}>
            {division.display.label}
          </option>
        ))}
      </select>
    </section>
  )
}
