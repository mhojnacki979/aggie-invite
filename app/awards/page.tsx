import type { Metadata } from 'next'
import { AwardsView } from './awards-view'

// Reached by typing the URL on ceremony day, so it stays out of search results.
export const metadata: Metadata = {
  title: 'Awards · Aggie Invitational',
  robots: { index: false, follow: false },
}

export default function AwardsPage() {
  return <AwardsView />
}
