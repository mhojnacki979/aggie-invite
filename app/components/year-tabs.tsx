import Link from 'next/link'
import { CURRENT_EVENT, YEARS } from '@/config/event'

interface Tab {
  year: number
  label: string
  href: string
  isLive: boolean
}

/** The live year first (linking home), then every other archive year, newest first. */
function buildTabs(): Tab[] {
  const liveYear = CURRENT_EVENT.year
  const past = YEARS.filter((y) => y.year !== liveYear).map((y) => ({
    year: y.year,
    label: y.label,
    href: `/past/${y.year}/`,
    isLive: false,
  }))
  return [{ year: liveYear, label: String(liveYear), href: '/', isLive: true }, ...past]
}

function isCurrent(tab: Tab, current: number | 'live' | null): boolean {
  if (current === null) return false
  if (tab.isLive) return current === 'live' || current === tab.year
  return current === tab.year
}

/** One link per year. `current` is 'live' on the home page, a year on a past-results page, null elsewhere. */
export function YearTabs({ current }: { current: number | 'live' | null }) {
  return (
    <nav aria-label="Year" className="year-tabs">
      <ul>
        {buildTabs().map((tab) => (
          <li key={tab.year}>
            <Link href={tab.href} aria-current={isCurrent(tab, current) ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
