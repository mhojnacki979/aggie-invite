import type { Metadata } from 'next'
import { CheckinView } from './checkin-view'

// For the TD's crew only: not linked from any public page, and kept out of search results.
export const metadata: Metadata = {
  title: 'Score check-in · Aggie Invitational',
  robots: { index: false, follow: false },
}

export default function CheckinPage() {
  return <CheckinView />
}
