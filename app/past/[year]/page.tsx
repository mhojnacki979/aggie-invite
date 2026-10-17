import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { YEARS, archiveConfigs } from '@/config/event'
import { HomeView } from '../../home/home-view'
import '../past.css'

interface PageProps {
  params: Promise<{ year: string }>
}

export function generateStaticParams(): { year: string }[] {
  return YEARS.map((entry) => ({ year: String(entry.year) }))
}

// A static export has no server to answer a year it did not build.
export const dynamicParams = false

/**
 * A finished year's results: the home page's board, served from the saved data. A year with several
 * tournaments (2022) stacks one board per tournament under its own heading, since their scores cannot share a leaderboard.
 * HomeView reads ?preview= with useSearchParams, which needs a Suspense boundary in a static export.
 */
export default async function PastPage({ params }: PageProps) {
  const { year } = await params
  const entry = YEARS.find((item) => String(item.year) === year)
  const configs = archiveConfigs(Number(year))
  const [only] = configs
  if (!entry || !only) notFound()

  if (configs.length === 1) {
    return (
      <Suspense fallback={null}>
        <HomeView config={only} note={null} />
      </Suspense>
    )
  }
  return (
    <div className="page">
      <h1 className="page-title">{entry.label} Aggie Invitational</h1>
      <p className="page-meta">{entry.dates} · PEAP, College Station</p>
      {configs.map((config) => (
        <section key={config.slug} className="past-section">
          <Suspense fallback={null}>
            <HomeView config={config} note={null} embedded />
          </Suspense>
        </section>
      ))}
    </div>
  )
}
