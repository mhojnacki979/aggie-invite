/**
 * Pre-event check: does the config match what EOS actually has?
 *
 *   pnpm preflight <tournamentId> [year]      year defaults to 2026
 *
 * Run this once the tournament exists in EOS and archers are registered, BEFORE
 * the event. The riskiest mismatch is the session keys: `lines` in the config
 * must match EOS's `session` field character for character, or every archer
 * lands on an "Other" line and the line strip stops meaning anything — and
 * nothing would reveal that until the first archer is scored.
 *
 * It runs the site's own parsing and view code, not a copy of it, so a pass
 * here means the real page will behave.
 */
import { EVENT_2025, EVENT_2026 } from '../src/config/event'
import { parseDivisionName } from '../src/lib/divisions'
import { fetchScoreList } from '../src/lib/eos'
import { OTHER_LINE_KEY, lineKeyFor, sessionKey } from '../src/lib/schedule'
import { buildEventView } from '../src/lib/status'
import type { EventConfig } from '../src/lib/types'

function requireArg(value: string | undefined): string {
  if (value === undefined || value === '') {
    console.error('usage: pnpm preflight <tournamentId> [year]')
    process.exit(2)
  }
  return value
}

const tournamentId = requireArg(process.argv[2])
const yearArg = process.argv[3]
const config: EventConfig = yearArg === '2025' ? EVENT_2025 : EVENT_2026

let failed = 0
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed += 1
}

async function main(): Promise<void> {
  console.log(`checking tournament ${tournamentId} against ${config.name}\n`)

  const { rows, skipped } = await fetchScoreList(tournamentId)
  console.log(`EOS returned ${rows.length} archers (${skipped} rows skipped)\n`)

  console.log('archers')
  check(rows.length > 0, 'tournament has archers', `${rows.length}`)
  check(skipped === 0, 'every row parsed', skipped === 0 ? '' : `${skipped} skipped`)

  // --- the one that matters most -------------------------------------------
  console.log('\nshooting lines (the highest-risk check)')
  const configured = config.lines.map((l) => l.key)
  const actual = [...new Set(rows.map((r) => sessionKey(r.session)))].sort()
  const unmatched = actual.filter((k) => !configured.includes(k))
  const unused = configured.filter((k) => !actual.includes(k))
  const other = rows.filter((r) => lineKeyFor(r, config.lines) === OTHER_LINE_KEY)

  check(other.length === 0, 'every archer maps to a configured line',
    other.length === 0 ? '' : `${other.length} archers would land on "Other"`)
  check(unmatched.length === 0, 'no unexpected session keys in EOS',
    unmatched.length === 0 ? '' : unmatched.map((k) => JSON.stringify(k)).join(', '))
  if (unused.length > 0) {
    console.log(`  note  configured lines with no archers yet: ${unused.join(', ')}`)
  }
  console.log('  EOS session keys found:')
  for (const k of actual) {
    const n = rows.filter((r) => sessionKey(r.session) === k).length
    const known = configured.includes(k)
    console.log(`     ${known ? ' ok ' : ' ?? '} ${JSON.stringify(k)}  ${n} archers`)
  }

  // --- divisions -----------------------------------------------------------
  console.log('\ndivisions')
  const names = [...new Set(rows.map((r) => r.division))]
  const parsed = names.map((n) => ({ raw: n, d: parseDivisionName(n) }))
  const unknown = parsed.filter((p) => !p.d.known)
  const slugs = parsed.map((p) => p.d.slug)
  check(unknown.length === 0, 'every division name parses',
    unknown.length === 0 ? `${names.length} divisions` : unknown.map((u) => u.raw).join('; '))
  check(new Set(slugs).size === slugs.length, 'division slugs are unique',
    `${new Set(slugs).size} of ${slugs.length}`)

  // --- round shape ---------------------------------------------------------
  console.log('\nround format')
  const due = [...new Set(rows.map((r) => r.arrowsDue))]
  const roundCounts = [...new Set(rows.map((r) => r.rounds.length))]
  check(due.length === 1, 'all archers shoot the same arrow count', `arrowsDue ${due.join(', ')}`)
  check(roundCounts.length === 1, 'all archers have the same round count',
    `rounds ${roundCounts.join(', ')}`)
  const ends = (due[0] ?? 0) / 3
  console.log(`  note  the line strip will read "End n of ${ends}"`)

  // --- the real view -------------------------------------------------------
  console.log('\nrendered view')
  const view = buildEventView(rows, config)
  check(view.lines.length === config.lines.length,
    'line strip has the expected number of lines', `${view.lines.length}`)
  check(view.divisions.length > 0, 'divisions build', `${view.divisions.length}`)
  const ties = view.divisions.filter((d) => d.tieFor !== null)
  if (ties.length > 0) {
    console.log(`  note  ${ties.length} division(s) currently tied on a podium place:`)
    for (const d of ties) console.log(`     ${d.display.label} — tie for ${d.tieFor}`)
  }

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err: unknown) => {
  console.error('preflight could not run:', err instanceof Error ? err.message : err)
  process.exit(1)
})
