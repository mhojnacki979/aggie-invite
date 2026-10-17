'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { YearTabs } from './year-tabs'

const PAST_PATH = /^\/past\/(\d{4})\/?$/

/** Which year tab to mark: the home page is the live year, /past/<year>/ is that year, other pages none. */
function currentTab(pathname: string): number | 'live' | null {
  if (pathname === '/') return 'live'
  const year = PAST_PATH.exec(pathname)?.[1]
  return year ? Number(year) : null
}

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark">
          Aggie Invitational
        </Link>
        <YearTabs current={currentTab(pathname)} />
      </div>
    </header>
  )
}
