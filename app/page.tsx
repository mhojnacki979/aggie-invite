import { Suspense } from 'react'
import { CURRENT_EVENT, NEXT_EVENT_NOTE } from '@/config/event'
import { HomeView } from './home/home-view'

// HomeView reads ?preview= with useSearchParams, which needs a Suspense boundary in a static export.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeView config={CURRENT_EVENT} note={NEXT_EVENT_NOTE} />
    </Suspense>
  )
}
