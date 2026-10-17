import { Suspense } from 'react'
import { DivisionBoard } from './division-board'

// DivisionBoard reads the query string with useSearchParams, which needs a Suspense boundary in a static export.
export default function DivisionPage() {
  return (
    <Suspense fallback={null}>
      <DivisionBoard />
    </Suspense>
  )
}
