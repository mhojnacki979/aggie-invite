import Link from 'next/link'
import { YEARS } from '../../src/config/event'

/** One link per archive year, newest first, after the live year. */
export function YearTabs({ current }: { current: number | 'live' }) {
  const tabs: { key: number | 'live'; label: string; href: string }[] = [
    { key: 'live', label: 'Live', href: '/' },
    ...YEARS.map((y) => ({ key: y.year, label: y.label, href: `/${y.year}/` })),
  ]
  return (
    <nav aria-label="Year">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link href={tab.href} aria-current={tab.key === current ? 'page' : undefined}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
