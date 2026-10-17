/**
 * Save a finished tournament as static JSON so its page never calls EOS.
 *
 *   pnpm freeze <slug>   one tournament (a YEARS slug such as 2025 or 2022-joad, or 2026)
 *   pnpm freeze          every slug in YEARS
 *
 * Writes public/data/<slug>.json (the leaderboard) and
 * public/data/<slug>-cards.json (scorecards keyed by shooter id).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EVENT_2026, YEARS } from '../src/config/event'
import { EosHttpError, fetchScoreList, fetchScorecard } from '../src/lib/eos'
import type { FrozenEvent } from '../src/lib/frozen'
import { eventDates } from '../src/lib/schedule'
import type { Scorecard } from '../src/lib/types'

const DATA_DIR = join(import.meta.dirname, '..', 'public', 'data')
const CONCURRENCY = 4

interface Target {
  year: number
  slug: string
  name: string
  tournamentId: string
}

function allTargets(): Target[] {
  return YEARS.flatMap((entry) =>
    entry.tournaments.map((t) => ({ year: entry.year, slug: t.slug, name: t.name, tournamentId: t.id })),
  )
}

function findTarget(slug: string): Target | null {
  if (slug === EVENT_2026.slug) {
    const { year, name, tournamentId } = EVENT_2026
    return { year, slug, name, tournamentId }
  }
  return allTargets().find((target) => target.slug === slug) ?? null
}

/** A dropped connection or a timeout. An EOS answer, even a "no", is not retried. */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')
}

/**
 * EOS rate-limits scorecard calls (HTTP 429 after roughly 60 in a few seconds).
 * A 429 is a request to slow down, not an answer, so every worker pauses
 * together and the call is tried again. Capped, so a hard block still fails.
 */
const RATE_LIMIT_PAUSE_MS = 15_000
const MAX_RATE_LIMIT_WAITS = 12
let resumeAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchCardOnce(tournamentId: string, shooterId: string): Promise<Scorecard> {
  try {
    return await fetchScorecard(tournamentId, shooterId)
  } catch (error) {
    if (!isNetworkFailure(error)) throw error
    return fetchScorecard(tournamentId, shooterId)
  }
}

async function fetchCardWithRetry(tournamentId: string, shooterId: string): Promise<Scorecard> {
  for (let waits = 0; ; waits++) {
    await sleep(Math.max(0, resumeAt - Date.now()))
    try {
      return await fetchCardOnce(tournamentId, shooterId)
    } catch (error) {
      if (!(error instanceof EosHttpError) || error.status !== 429 || waits >= MAX_RATE_LIMIT_WAITS) throw error
      const pause = error.retryAfterMs ?? RATE_LIMIT_PAUSE_MS
      console.error(`EOS rate limit (429); pausing ${pause / 1000}s`)
      resumeAt = Math.max(resumeAt, Date.now() + pause)
    }
  }
}

/** Run `work` over `items`, at most `limit` at a time. */
async function mapLimited<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      const item = items[index]
      if (item !== undefined) results[index] = await work(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchCards(tournamentId: string, shooterIds: string[]): Promise<Record<string, Scorecard>> {
  const pairs = await mapLimited(shooterIds, CONCURRENCY, async (id) => {
    const card = await fetchCardWithRetry(tournamentId, id)
    return [id, card] as const
  })
  return Object.fromEntries(pairs)
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, name), JSON.stringify(value))
}

async function freeze(target: Target): Promise<void> {
  const { rows } = await fetchScoreList(target.tournamentId)
  if (rows.length === 0) throw new Error(`${target.slug}: EOS returned 0 archers; nothing written`)
  const shooters = rows.filter((row) => row.arrowsShot > 0).map((row) => row.shooterId)
  const cards = await fetchCards(target.tournamentId, shooters)
  const frozen: FrozenEvent = {
    year: target.year,
    slug: target.slug,
    name: target.name,
    dates: eventDates(rows),
    tournamentId: target.tournamentId,
    frozenAt: new Date().toISOString(),
    rows,
  }
  await writeJson(`${target.slug}.json`, frozen)
  await writeJson(`${target.slug}-cards.json`, cards)
  console.log(`${target.slug}: ${rows.length} archers, ${shooters.length} scorecards`)
}

async function main(): Promise<void> {
  const slug = process.argv[2]
  if (slug === undefined) {
    for (const target of allTargets()) await freeze(target)
    return
  }
  const target = findTarget(slug)
  if (!target) {
    const known = [...allTargets().map((t) => t.slug), EVENT_2026.slug].join(', ')
    throw new Error(`Unknown slug "${slug}". Known: ${known}`)
  }
  await freeze(target)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
