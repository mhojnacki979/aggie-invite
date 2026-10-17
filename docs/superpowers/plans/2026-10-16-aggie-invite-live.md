# Aggie Invitational Live Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder at aggieinvite.eyesonscore.com with a line-by-line live scoring and results site for the Aggie Invitational, fed by old EOS.

**Architecture:** Next.js 15 static export on GitHub Pages, same shape as the Texas Ringer site. The browser polls one EOS endpoint every 20 seconds. Pure functions in `src/lib/` turn the rows into lines, division statuses, podiums and ties. React pages render that view. Finished years are frozen to JSON under `public/data/` and fetched at runtime.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), Zod 3, Vitest 2, pnpm 10, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-16-aggie-invite-live-design.md`. Read it first. The status rules there are the source of truth for Task 4.

**Repo:** `~/Documents/aggie-invite` (`mhojnacki979/aggie-invite`, branch `main`, placeholder already deployed). Reference repo, read only: `~/Documents/eyesonscore-series-rankings` (Texas Ringer).

## Global Constraints

- Node 20.x, `packageManager: pnpm@10.33.0`, `next ^15.3.0`, `react`/`react-dom ^19.1.0`, `zod ^3.23.8`, `vitest ^2.0.0`, `tsx ^4.16.0`, `typescript ^5.5.0`.
- `next.config.mjs`: `output: 'export'`, `trailingSlash: true`, `images: { unoptimized: true }`, `basePath: ''`.
- TypeScript strict with `noUncheckedIndexedAccess`. No `any` in new code. Functions under 50 lines, files under 500.
- EOS is read only. One `tournament_score_list` call per poll per visitor. Poll every `20_000` ms. No polling while the tab is hidden. Scorecards only on tap.
- Every EOS fetch has a 15-second timeout.
- Colors: maroon `#500000`, gold `#d9a521`, silver `#bfc3cc`, bronze `#c27a3a`. Fonts: Roboto Slab (headings), Work Sans (body), tabular numbers for scores.
- Text wordmark "Aggie Invitational". No Texas A&M logo. Footer "Scores by Eyes on Score".
- Exact copy: `Provisional`, `Final`, `Shooting now`, `Upcoming`, `End {n} of {ends}` (`ends` = `arrowsDue / 3`: 20 for a 60-arrow round, 40 for the 2022 Double FITA), `{n} of {m} still to shoot`, `Tie for {1st|2nd|3rd}`, `Same score, 10s and 9s: shoot-off needed`, `JOAD line`, `2026 live scoring starts Fri, Nov 6 at 6:00 PM`.
- Works at 375px wide with no horizontal page scroll. Light theme by default. A dark theme follows `prefers-color-scheme`.
- Commit messages: plain sentence subject plus a short body, matching the sibling repos. No ticket prefix, no Co-Authored-By trailer.
- Live and tested by Sun Nov 1, 2026. Dry run Nov 2–5. Event Nov 6–8.
- **Never push without Michael's explicit OK.** Pushing to `main` deploys the live site.

**Amendment A (2026-10-17, Michael):** the site covers EVERY year EOS holds — 2022, 2023, 2024, 2025 — with a year tab switcher. 2022 is two separate tournaments (a 120-arrow/4-round Double FITA and a 60-arrow JOAD event) shown as two sections under one 2022 tab. This supersedes the "Past results cover 2023–2025, not 2022" call. Task 12 amends the already-built data layer; Tasks 4, 7, 8 and 9 below carry the changes. Where this amendment and an older line disagree, the amendment wins.

## Review Focus

1. **EOS returns an empty `sortingResult`** (seen on Aggie Prep before its first arrow). Expect five Upcoming lines, "Podiums appear here once scoring starts", and no crash. Covered by Task 4 test 11 and the Task 7 browser check.
2. **A session string that matches no configured line**, for example EOS formatting a 2026 time differently. Those archers go under an "Other" line, and nobody disappears. Covered by Task 3 test 3 and Task 4 test 12.
3. **A division label we've never seen**, such as `Traditional U18 Female`. It shows under its raw name and sorts after the known bow styles. Covered by Task 2 test 7.
4. **A failed poll mid-event** (gym Wi-Fi drops, EOS 500). The last good scores stay up with "Reconnecting…", and the next good poll clears the note. Covered by Task 6 tests 2–3.
5. **Names with apostrophes and commas** (`Nicholas D'Amour`, `Finis Jordan, Jr`). They must work in search, in slugs and in the scorecard. Covered by Task 5 tests 2–3 and the Task 8 browser check.

---

### Task 1: Project scaffold and the EOS boundary

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.nvmrc`
- Create: `src/lib/types.ts`, `src/lib/eos-schema.ts`, `src/lib/eos.ts`
- Create: `src/test/fixtures/aggie-2025-score-list.json`, `src/test/fixtures/aggie-2025-scorecard-damour.json`
- Test: `src/lib/eos-schema.test.ts`

**Interfaces:**
- Produces (`src/lib/types.ts`):
  ```ts
  export interface ArcherRow {
    shooterId: string; name: string; division: string; rank: number
    half1: number; half2: number; total: number; tens: number; nines: number
    target: string; session: string; arrowsShot: number; arrowsDue: number; avg: string
  }
  export interface EndScore { arrows: string[]; score: number; running: number }
  export interface Scorecard { name: string; total: number; avg: string; target: string; ends: EndScore[] }
  ```
- Produces (`src/lib/eos-schema.ts`): `parseScoreList(data: unknown): { rows: ArcherRow[]; skipped: number }`, `parseScorecard(data: unknown): Scorecard`
- Produces (`src/lib/eos.ts`): `EOS_API = 'https://api.eyesonscore.com/api'`, `fetchScoreList(tournamentId: string): Promise<{ rows: ArcherRow[]; skipped: number }>`, `fetchScorecard(tournamentId: string, shooterId: string): Promise<Scorecard>`

Field mapping: `shooter_id→shooterId` (String), the group key → `division`, `rank`, `round_1→half1`, `round_2→half2`, `total_score→total`, `tens_count→tens`, `nine_count→nines`, `target`, `session` (kept raw, trailing space and all), `total_attended_arrows_count→arrowsShot`, `total_arrow_count→arrowsDue`, `avg_count→avg`. Use `z.coerce.number()` for numbers. A group value is an archer row only if it is an object with a `name`. Drop rows that fail the schema and count them in `skipped`; don't throw.

Scorecard mapping, from `shooter_details_by_score`:
- `shooter_name`, `total_score`, `avg_count`, `target_name_position`.
- `ends`: walk `slot_list[].round_score_list[]`, then each round's `endN` keys in numeric order. Arrows are the `arrowN` values as strings, in arrow order. `score` is `per_end_total`.
- `running` is the cumulative sum of `per_end_total` across **all** rounds. Do not use EOS `end_total`, which resets each round.

- [ ] **Step 1: Scaffold.** Copy `tsconfig.json`, `next.config.mjs` and `vitest.config.ts` from the reference repo. In `vitest.config.ts`, drop the Railway comment and `testTimeout`. Write `package.json` with name `aggie-invite`, `"type": "module"`, the versions above, and these scripts: `dev: next dev -p 3100`, `build: next build`, `test: vitest run`, `typecheck: tsc --noEmit`, `freeze: tsx scripts/freeze.ts`. Write `.nvmrc` = `20`. Run `pnpm install`.
- [ ] **Step 2: Save the fixtures.** In `src/lib/eos.ts`, add `const TOKEN` copied from the `TOKEN` constant in the reference repo's `src/lib/eos.ts`. It is EOS's public scoreboard token. Then run:
  ```bash
  TOK=$(sed -n "s/^const TOKEN = '\(.*\)'$/\1/p" src/lib/eos.ts)
  mkdir -p src/test/fixtures
  curl -s -X POST -H "Authorization: $TOK" "https://api.eyesonscore.com/api/tournament_score_list?is_private=false&id=QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09&for_fav=true" -o src/test/fixtures/aggie-2025-score-list.json
  SID=$(node -e "const d=require('./src/test/fixtures/aggie-2025-score-list.json').data.sortingResult['Recurve Senior Male'];console.log(Object.values(d).find(r=>r&&r.name===\"Nicholas D'Amour\").shooter_id)")
  curl -s -X POST -H "Authorization: $TOK" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "shooter_id=$SID" --data-urlencode "tournament_id=QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09" https://api.eyesonscore.com/api/shooter_details_by_score -o src/test/fixtures/aggie-2025-scorecard-damour.json
  ```
  Expected: both files start with `{"status_code":200`.
- [ ] **Step 3: Write the failing tests** in `src/lib/eos-schema.test.ts`. Load fixtures with `readFileSync` and pass `.data`.
  - `parses all 2025 archers`: `rows.length === 512`, `skipped === 0`, `new Set(rows.map(r => r.division)).size === 49`.
  - `maps D'Amour's row`: the row named `Nicholas D'Amour` matches `{ division: 'Recurve Senior Male', rank: 1, half1: 292, half2: 295, total: 587, tens: 47, nines: 13, target: '23B', session: 'College Station, 11-08-2025 01:00 PM ', arrowsShot: 60, arrowsDue: 60, avg: '9.78' }` (`toMatchObject`), and `shooterId` is a non-empty string.
  - `drops metadata keys`: `parseScoreList({ sortingResult: { G: { max_round_count: 2, '0': <a copy of D'Amour's raw row> } } }).rows.length === 1`.
  - `skips a bad row`: the same group with `total_score: 'abc'` gives `{ rows: [], skipped: 1 }`.
  - `parses D'Amour's scorecard`: `ends.length === 20`. `ends[0]` equals `{ arrows: ['10','10','9'], score: 29, running: 29 }`. `ends[9].running === 292`, `ends[19].running === 587`, `total === 587`, `target === '23B'`.
- [ ] **Step 4: Run** `pnpm test src/lib/eos-schema.test.ts`. Expected: FAIL, because the module is not found.
- [ ] **Step 5: Implement** `types.ts`, `eos-schema.ts` and `eos.ts`.
  - `eos.ts` POSTs with the `Authorization` header and `AbortSignal.timeout(15_000)`.
  - It throws `Error(message)` when `status_code !== 200`.
  - `fetchScorecard` sends a form-encoded body, as the reference `postForm` does.
  - Validate the raw shapes with Zod in `eos-schema.ts`.
- [ ] **Step 6: Run** `pnpm test && pnpm typecheck`. Expected: 5 passed, no type errors.
- [ ] **Step 7: Commit**: `git add -A && git commit -m "Scaffold the app and parse EOS score lists and scorecards"`

---

### Task 2: Division names

**Files:** Create `src/lib/divisions.ts`. Test `src/lib/divisions.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface DivisionName {
    bow: string; age: string; gender: 'Women' | 'Men' | null
    label: string; slug: string; known: boolean; sortKey: [number, number, number]
  }
  export function parseDivisionName(raw: string): DivisionName
  export function compareDivisions(a: DivisionName, b: DivisionName): number
  ```

Parsing:
- **Gender** is the last word: `Female`→`Women`, `Male`→`Men`.
- **Bow** is the longest case-insensitive prefix match from the table below. **Age** is the first word after the bow, mapped through the age table. Any trailing words like `Cub`, `Bowman`, `Cadet` or `Junior` are dropped.
- **No bow match:** `known: false`, `label` is the trimmed raw name, and the sort key is `[9, 99, 9]`.
- **Label** is `${bow} ${age} ${gender}`.
- **Slug** is the label lowercased, with `+` turned into `plus`, every run of other non-alphanumerics turned into `-`, and edge dashes trimmed.

| Bow display (sort index) | Matches |
|---|---|
| Recurve (0) | `Recurve` |
| Compound (1) | `Compound` |
| Barebow (2) | `BAREBOW (recurve)`, `Barebow (recurve)`, `Barebow` |
| Fixed Pins (3) | `Fixed Pins`, `Fixed Pin` |
| Para Recurve, Para Compound, Para Compound VI, Para W1, Para V.I. (4) | same text |

Age order: `U13, U15, U18, U21, Senior, Amateur, 50+, 50–70+, 60+, 70+`. `50-70+` is displayed as `50–70+`. Gender order: Women, then Men.

- [ ] **Step 1: Write the failing tests**:
  1. `'BAREBOW (recurve) Senior Female'` → `{ bow: 'Barebow', age: 'Senior', gender: 'Women', label: 'Barebow Senior Women', slug: 'barebow-senior-women', known: true }`
  2. `'Fixed Pin U18 Cadet Male'` → label `'Fixed Pins U18 Men'`
  3. `'Compound U15 Cub Male'` → label `'Compound U15 Men'`
  4. `'Para W1 Senior Male'` → label `'Para W1 Senior Men'`
  5. `'Recurve 50+ Male'` → slug `'recurve-50plus-men'`
  6. `'Barebow (recurve) 50-70+ Female'` → label `'Barebow 50–70+ Women'`
  7. `'Traditional U18 Female'` → `known: false`, label `'Traditional U18 Female'`, and it sorts after `'Para Recurve Senior Male'`
  8. Sorting `['Recurve Senior Male','Recurve U13 Female','Compound U13 Male','Recurve U13 Male']` gives `['Recurve U13 Female','Recurve U13 Male','Recurve Senior Male','Compound U13 Male']`
  9. Every one of the 49 divisions in the 2025 fixture parses with `known: true`, and their 49 slugs are unique
- [ ] **Step 2: Run** `pnpm test src/lib/divisions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseDivisionName` and `compareDivisions` in `src/lib/divisions.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit**: `"Parse EOS division names into bow, age and gender"`

---

### Task 3: Schedule and event config

**Files:** Create `src/lib/schedule.ts` and `src/config/event.ts`. Modify `src/lib/types.ts`. Test `src/lib/schedule.test.ts`.

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export interface LineConfig { key: string; label: string; tag?: string }
  export interface EventConfig {
    year: number; name: string; dates: string; tournamentId: string; live: boolean
    lines: LineConfig[]; closedLines: string[]; shootOffs: Record<string, string[]>
  }
  ```
- Produces (`schedule.ts`): `OTHER_LINE_KEY = 'other'`, `sessionKey(session: string): string` (text after the last comma, trimmed), `lineKeyFor(row: ArcherRow, lines: LineConfig[]): string`, `deriveLines(rows: ArcherRow[]): LineConfig[]`, `eventDates(rows: ArcherRow[]): string`
- Produces (`config/event.ts`): `EVENT_2025`, `EVENT_2026`, `CURRENT_EVENT`, `ARCHIVE: { year: number; tournamentId: string; name: string; dates: string }[]`, `archiveConfig(year: number): EventConfig | null` (the ARCHIVE entry with `live: false`, `lines: []`, `closedLines: []`, `shootOffs: {}`), `NEXT_EVENT_NOTE: string | null`

Config values:
- `EVENT_2025`:
  - name `'2025 Aggie Invitational'`, dates `'Nov 7–9, 2025'`, tournamentId `'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09'`, `live: true`, `closedLines: []`, `shootOffs: {}`.
  - Lines: `{ '11-07-2025 06:00 PM', 'Fri 6:00 PM' }`, `{ '11-08-2025 08:00 AM', 'Sat 8:00 AM' }`, `{ '11-08-2025 01:00 PM', 'Sat 1:00 PM', tag: 'JOAD line' }`, `{ '11-08-2025 06:00 PM', 'Sat 6:00 PM' }`, `{ '11-09-2025 09:00 AM', 'Sun 9:00 AM' }`.
- `EVENT_2026`:
  - Same shape, with name `'2026 Aggie Invitational'`, dates `'Nov 6–8, 2026'`, `tournamentId: ''` (Michael fills it in once EOS has it), `live: true`.
  - Lines keyed `'11-06-2026 06:00 PM'`, `'11-07-2026 08:00 AM'`, `'11-07-2026 01:00 PM'` (tag `'JOAD line'`), `'11-07-2026 06:00 PM'`, `'11-08-2026 09:00 AM'`, with the same labels as 2025.
- `CURRENT_EVENT = EVENT_2025`, with a comment saying to switch it to `EVENT_2026` once the ID is set.
- `ARCHIVE`:
  - 2025, `'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09'`, `'2025 Aggie Invitational'`, `'Nov 7–9, 2025'`
  - 2024, `'a0FvWDBhcW1kVnF3bFRRY1lMTWE0dz09'`, `'2024 Aggie Invitational'`, `'Nov 22–24, 2024'`
  - 2023, `'bVRpazQxQ2NEbGRrQmpqUnR2RzZPUT09'`, `'2023 Aggie Invitational'`, `'Nov 3–5, 2023'`
  - 2024 and 2023 each had six lines, which is why archive years derive their lines from the data.
- `NEXT_EVENT_NOTE` is `'2026 live scoring starts Fri, Nov 6 at 6:00 PM'` while `CURRENT_EVENT.year < 2026`, otherwise `null`.

`deriveLines` sorts the distinct session keys by date and time, then labels each one with the weekday and the time without a leading zero. Get the weekday from `new Date(Date.UTC(y, m - 1, d)).getUTCDay()`. Never use local-time parsing. `eventDates` formats the first and last date as `'Nov 7–9, 2025'`.

- [ ] **Step 1: Write the failing tests**:
  1. `sessionKey('College Station, 11-08-2025 01:00 PM ') === '11-08-2025 01:00 PM'`
  2. `sessionKey('Scheels Sports Park, 3751 Imagineer Drive, Springfield, IL 62711, 12-14-2025 08:00 AM ') === '12-14-2025 08:00 AM'`
  3. A row with session `'College Station, 11-08-2025 1:00 PM'` maps to `'other'` with `EVENT_2025.lines`
  4. Every 2025 fixture row maps to one of the five configured keys, never `'other'`
  5. `deriveLines(fixtureRows)` gives keys `['11-07-2025 06:00 PM','11-08-2025 08:00 AM','11-08-2025 01:00 PM','11-08-2025 06:00 PM','11-09-2025 09:00 AM']` and labels `['Fri 6:00 PM','Sat 8:00 AM','Sat 1:00 PM','Sat 6:00 PM','Sun 9:00 AM']`
  6. `eventDates(fixtureRows) === 'Nov 7–9, 2025'`
  7. `CURRENT_EVENT.tournamentId !== ''`
  8. `archiveConfig(2024)` gives `{ live: false, lines: [], dates: 'Nov 22–24, 2024' }` (`toMatchObject`), and `archiveConfig(2019)` gives `null`
- [ ] **Step 2: Run** `pnpm test src/lib/schedule.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `schedule.ts` and `config/event.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit**: `"Add the line schedule and event config for 2025 and 2026"`

---

### Task 4: Status engine and preview

**Files:** Create `src/lib/status.ts` and `src/lib/preview.ts`. Test `src/lib/status.test.ts`.

**Interfaces:**
- Consumes: `ArcherRow`, `EventConfig`, `LineConfig` (Tasks 1, 3); `parseDivisionName`, `compareDivisions` (Task 2); `lineKeyFor`, `deriveLines`, `OTHER_LINE_KEY` (Task 3).
- Produces (`status.ts`):
  ```ts
  export type LineStatus = 'upcoming' | 'shooting' | 'final'
  export interface LineView { key: string; label: string; tag?: string; status: LineStatus; archers: number; endsShot: number }
  export interface DivisionView {
    name: string; display: DivisionName; status: 'provisional' | 'final'
    count: number; shot: number; remaining: number; tieFor: number | null
    rows: ArcherRow[]; podium: ArcherRow[]
  }
  export interface EventView { lines: LineView[]; divisions: DivisionView[]; lineByShooter: Record<string, LineView> }
  export function isDone(row: ArcherRow): boolean
  export function buildEventView(rows: ArcherRow[], config: EventConfig): EventView
  ```
- Produces (`preview.ts`): `parsePreview(param: string | null): { lineIndex: number; end: number } | null`, `cutAt(rows: ArcherRow[], lines: LineConfig[], lineIndex: number, end: number): ArcherRow[]`

Implement the spec's "Rules for status" exactly:
- **Lines:** use `config.lines`, or `deriveLines(rows)` when that list is empty. Add `{ key: 'other', label: 'Other' }` only when some row maps to it. Keep `lines` in config order.
- **The Other line never counts as a later line** in the "any later line has at least one arrow" rule. Its status uses only its own archers.
- **`shot`:** the number of rows with `arrowsShot > 0`.
- **`rows` (board order):** EOS rank, then EOS order, then `shootOffs`.
- **Shoot-offs:** if every name in the entry is found and they share one rank `r`, give them ranks `r, r+1, …` in the listed order. Otherwise leave the rows alone.
- **`podium`:** rows with `rank <= 3` and `arrowsShot > 0`.
- **`divisions`:** sorted by `compareDivisions`. Include every division, even ones with `shot === 0`. Pages decide what to show.

`cutAt` is for preview and tests only:
- Rows on lines before `lineIndex` are unchanged.
- Rows on later lines, or the Other line, get `arrowsShot`, `total`, `tens` and `nines` set to 0 and every entry of `rounds` set to 0.
- Rows on line `lineIndex` get `shot = min(row.arrowsShot, end * 3)`, then, with `per = row.arrowsDue / row.rounds.length` (30 for every real event):
  - For round `i`, let `shotIn = clamp(row.arrowsShot - i * per, 0, per)` (arrows the archer actually shot in that round) and `keptIn = clamp(shot - i * per, 0, per)` (arrows the cut keeps). Round `i` keeps `round(rounds[i] * keptIn / shotIn)`, or 0 when `shotIn` is 0.
  - **Scale against arrows actually shot, never against `per`.** An archer who stopped mid-round has already earned their whole round score on fewer than `per` arrows: Jenna Lopez (Compound Senior Female, 2025) scored 277 + 27 = 304 on 33 arrows, so dividing her 27 by a full 30 would display her as 280 even in a cut that keeps every arrow she shot. For an archer who completed the round the two divisors are equal, so nothing else changes.
  - `total` is the sum of the scaled `rounds`. `tens` and `nines` are scaled by `shot / row.arrowsShot`.
- Then re-rank each division by total, tens, then nines, all descending, with competition ranking (1, 1, 3). This re-ranking is allowed only because preview is a simulation.

`parsePreview` accepts `'^\d+-\d+$'` with `end` from 0 to 20. Anything else returns `null`. (Preview only ever runs against the live 60-arrow event, so 20 is the right cap here.)

- [ ] **Step 1: Write the failing tests.** `rows` is the parsed fixture and `cfg` is `EVENT_2025`.
  1. **Full 2025:** line statuses are all `'final'`, and line `archers` are `[100, 105, 101, 102, 104]`. Every division is `'final'`, and there are 49 divisions. The Sunday line has 9 no-shows and still reads final.
  2. **Compound U18 Male:** `tieFor === 1`, and the podium names are `['Brody Wonch','Caleb Quiocho','Chase Crotty']`.
  3. **Compound Senior Male:** `tieFor === 2`.
  4. **Recurve 50+ Male:** the podium has length 2, because the rank-3 archer has 0 arrows.
  5. **Para Compound Senior Male:** `shot === 0`, `status === 'final'`, and the podium is empty.
  6. **`shootOffs: { 'Compound U18 Male': ['Caleb Quiocho','Brody Wonch'] }`:** `tieFor === null`, the podium names are `['Caleb Quiocho','Brody Wonch','Chase Crotty']`, and the ranks are `[1, 2, 3]`.
  7. **A misspelled shoot-off name (`'Caleb Quicho'`):** `tieFor` stays `1`.
  8. **`cutAt(rows, cfg.lines, 2, 12)`:**
     - Statuses are `['final','final','shooting','upcoming','upcoming']`, and line 2 has `endsShot === 12`.
     - Recurve Senior Male is `'provisional'` with `remaining === 15` and `count === 30`.
     - Recurve U21 Male is `'provisional'` with `remaining === 4`.
  9. **The first fixture row on `'11-09-2025 09:00 AM'` with 60 arrows is set to `arrowsShot: 30`:** the Sunday line is `'shooting'`, and that archer's division is `'provisional'` with `remaining === 1`.
  10. **Test 9 plus `closedLines: ['11-09-2025 09:00 AM']`:** the Sunday line is `'final'`, and that division is `'final'`.
  11. **`buildEventView([], cfg)`:** 5 lines, all `'upcoming'`, all with `archers === 0`, and `divisions` is `[]`.
  12. **One row's session changed to `'College Station, 11-08-2025 1:00 PM'`:** the view has 6 lines, the last is `{ key: 'other', label: 'Other' }` with `archers === 1`, and the row still appears in its division.
  12b. **The Other line doesn't close real lines:** take `cutAt(rows, cfg.lines, 2, 12)`, then move one Friday row (60 arrows) to that misformatted session. The first five statuses are still `['final','final','shooting','upcoming','upcoming']`.
  13. **Compound Senior Female** (its Friday archer stopped at 33 arrows) is `'final'`.
  14. **`parsePreview`:** `'2-12'` gives `{ lineIndex: 2, end: 12 }`. `'2-21'`, `'x'` and `null` all give `null`.
- [ ] **Step 2: Run** `pnpm test src/lib/status.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `status.ts` as small helpers: line grouping, line status, shoot-off application, division view. Each one is under 50 lines. Then implement `preview.ts`.
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit**: `"Compute line status, provisional and final divisions, podiums and ties"`

---

### Task 5: Archer search

**Files:** Create `src/lib/search.ts`. Test `src/lib/search.test.ts`.

**Interfaces:**
- Consumes: `EventView`, `DivisionView`, `LineView` (Task 4).
- Produces:
  ```ts
  export interface ArcherHit { row: ArcherRow; division: DivisionView; line: LineView | undefined; place: number }
  export function searchArchers(view: EventView, query: string, limit?: number): ArcherHit[]
  ```

How matching works:
- **Normalize:** lowercase, remove `'`, `’`, `,` and `.`, and collapse spaces.
- **Too short:** if the query is under 2 characters after normalizing, return `[]`.
- **Match:** a row matches when every query word is a prefix of some word in the name, or when the whole query is a substring of the normalized name.
- **Order:** exact full-name matches first, then by name. `limit` defaults to 20.
- **`place`:** the row's rank after shoot-offs.

- [ ] **Step 1: Write the failing tests** against `buildEventView(fixtureRows, EVENT_2025)`:
  1. `'crotty'` returns 1 hit, with name `'Chase Crotty'`, `division.display.label` `'Compound U18 Men'`, `line.label` `'Sat 8:00 AM'`, `row.target` `'11D'` and `place` 3.
  2. `"d'amour"` and `'damour'` both hit `"Nicholas D'Amour"` with `place` 1 and `line.tag` `'JOAD line'`.
  3. `'jordan jr'` hits `'Finis Jordan, Jr'`.
  4. `'c'` and `'zzzz'` both return `[]`.
  5. `'an'` with `limit` 5 returns exactly 5 hits.
- [ ] **Step 2: Run** `pnpm test src/lib/search.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `searchArchers`.
- [ ] **Step 4: Run** `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit**: `"Add find-an-archer search"`

---

### Task 6: Live data, frozen data and the freeze script

**Files:**
- Create: `src/lib/fetch-state.ts`, `src/lib/use-event-data.ts`, `src/lib/frozen.ts`, `scripts/freeze.ts`
- Create (generated): `public/data/2025.json`, `public/data/2025-cards.json`
- Test: `src/lib/fetch-state.test.ts`
- Modify: `src/lib/eos.ts` (the `res.ok` check below)

**Interfaces:**
- Consumes: `fetchScoreList`, `fetchScorecard` (Task 1); `EventConfig`, `YEARS`, `archiveConfigs`, `EVENT_2026` (Tasks 3 and 12); `eventDates` (Task 3).
- Produces:
  ```ts
  // frozen.ts
  export interface FrozenEvent { year: number; slug: string; name: string; dates: string; tournamentId: string; frozenAt: string; rows: ArcherRow[] }
  export function loadFrozen(slug: string): Promise<FrozenEvent>                 // fetch `/data/${slug}.json`
  export function loadFrozenCard(slug: string, shooterId: string): Promise<Scorecard | null> // fetch `/data/${slug}-cards.json` once, cache per slug
  // fetch-state.ts
  export interface FetchState { rows: ArcherRow[] | null; updatedAt: number | null; error: boolean }
  export const INITIAL_FETCH_STATE: FetchState
  export type FetchOutcome = { ok: true; rows: ArcherRow[]; at: number } | { ok: false }
  export function nextFetchState(prev: FetchState, outcome: FetchOutcome): FetchState
  // use-event-data.ts ('use client')
  export const POLL_MS = 20_000
  export function useEventData(config: EventConfig): FetchState
  ```

How `useEventData` behaves:
- **Not live:** if `config.live` is false, load `loadFrozen(config.slug)` once, and set `updatedAt` to `Date.parse(frozenAt)`.
- **Live:** fetch on mount, then every `POLL_MS`. Skip a tick when `document.hidden`. Fetch right away when `visibilitychange` turns visible. Ignore results that arrive after unmount. Every result goes through `nextFetchState`.

What `scripts/freeze.ts <slug>` does. **It takes a tournament SLUG, not a year**, because 2022 is two tournaments (`2022-double-fita` and `2022-joad`):
1. Finds the tournament whose `slug` matches across every `YEARS` entry, or uses `EVENT_2026` for slug `2026`, and calls `fetchScoreList`.
2. Refuses to write anything when there are 0 rows, and exits non-zero on an unknown slug.
3. Fetches the scorecard of every row with `arrowsShot > 0`, 4 at a time. Each call is retried once on a network error or timeout, but not on an EOS error status.
4. Writes `public/data/<slug>.json` (a `FrozenEvent` whose `dates` come from `eventDates`) and `public/data/<slug>-cards.json` (`Record<shooterId, Scorecard>`), both minified.
5. Prints `<slug>: <rows> archers, <cards> scorecards`.
6. With no argument, freezes every slug in `YEARS` in turn.

Also in this task — `src/lib/eos.ts` `post()` must check `res.ok` before parsing the body. Today a proxy 502 or a 429 HTML page surfaces as a bare `SyntaxError` from `res.json()`, naming neither the endpoint nor the status, which is what a visitor's phone hits when the gym Wi-Fi drops. Throw an `Error` carrying the HTTP status and the endpoint instead. The page behaviour is unchanged (the caller still shows the last good scores and `Reconnecting…`); this only makes the failure legible.

- [ ] **Step 1: Write the failing tests** for `nextFetchState`:
  1. Initial state plus `{ ok: true, rows: [r], at: 1000 }` gives `{ rows: [r], updatedAt: 1000, error: false }`.
  2. A state with rows plus `{ ok: false }` keeps the same `rows` and `updatedAt`, with `error: true`.
  3. That error state plus `{ ok: true, rows: [r2], at: 2000 }` gives `error: false` and `updatedAt: 2000`.
- [ ] **Step 2: Run** `pnpm test src/lib/fetch-state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `fetch-state.ts`, then `frozen.ts`, `use-event-data.ts` and `scripts/freeze.ts`.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: all pass.
- [ ] **Step 5: Freeze 2025.** Run `pnpm freeze 2025`. Expected output: `2025: 512 archers, 468 scorecards`. `public/data/2025.json` should be under 300 KB. (Task 9 freezes the remaining slugs; do not freeze them here.)
- [ ] **Step 6: Commit**: `"Poll EOS for live data, load frozen years, and add the freeze script"`

---

### Task 7: Layout, theme and the home page

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `app/home/home-view.tsx`, `app/home/line-strip.tsx`, `app/home/podium-card.tsx`, `app/home/archer-search.tsx`
- Create: `.claude/launch.json` with `{ name: 'aggie-dev', runtimeExecutable: 'pnpm', runtimeArgs: ['dev'], port: 3100 }`

**Interfaces:**
- Consumes: `useEventData` (Task 6), `buildEventView` (Task 4), `cutAt`, `parsePreview` (Task 4), `searchArchers` (Task 5), `CURRENT_EVENT`, `NEXT_EVENT_NOTE` (Task 3).
- Produces: `HomeView({ config, note }: { config: EventConfig; note: string | null })`, a client component that Task 9 reuses. Division links use `/division/?d=${slug}` plus `&y=${year}` when the config is not live.

Layout and copy:
- **Header:** a maroon band with the wordmark "Aggie Invitational" in Roboto Slab 700, and under it a year tab strip (Task 12's `YearTabs`): one tab per entry in `YEARS`, newest first, the current one marked `aria-current="page"`. The live year's tab reads `2026` once `CURRENT_EVENT` is 2026, and `2025` until then.
- **Fonts:** load them with `next/font/google` (`Roboto_Slab`, `Work_Sans`), as the reference layout does.
- **Home:**
  1. Title `config.name`, with meta `${config.dates} · PEAP, College Station`.
  2. A status line, `Updated {n}s ago` or `Reconnecting…`.
  3. The `note` banner when it is set.
  4. The line strip. Each card shows its label, its tag, `{n} archers` (hidden when 0) and a status pill. A shooting card also shows `End {n} of 20` and a progress bar.
  5. Search, with up to 20 results. Each shows the name, division label, line label and tag, target, place, total, and that division's badge, and links to the division board with `&a={shooterId}`.
  6. A heading: `Podiums so far`, or `Final podiums` when every shown division is final.
  7. Podium cards for divisions with `shot > 0`. Each card has its label, a badge (`Provisional`, `Final`, or `Tie for 1st/2nd/3rd`), medal rows, and a footer: `{remaining} of {count} still to shoot`, `All {shot} have shot`, or `Same score, 10s and 9s: shoot-off needed`.
  8. When no division has scores: `Podiums appear here once scoring starts.`
- **Preview:** `?preview=L-E` runs `cutAt` before `buildEventView` and shows a small "Preview" banner. Read it with `useSearchParams` inside `<Suspense>` in `app/page.tsx`.
- **Tokens** in `:root` (light). Light: `--bg #f7f4ef`, `--card #ffffff`, `--line #e2dcd2`, `--text #221f1c`, `--muted #6f6860`, `--prov-bg #efe2c4`, `--prov-text #5c4307`, `--final-bg #dcebdc`, `--final-text #1f4d22`, `--tie-bg #f6d6d6`, `--tie-text #6b1414`.
- **Dark** (`@media (prefers-color-scheme: dark)`): `--bg #0b0a0b`, `--card #141114`, `--line #2a262c`, `--text #ececee`, `--muted #8e8a92`, `--prov-bg #3a2c0c`, `--prov-text #f3d58a`, `--final-bg #16301a`, `--final-text #9fd8a4`, `--tie-bg #3d1414`, `--tie-text #ffb3b3`. The brand and medal colors from Global Constraints apply in both themes.

- [ ] **Step 1: Build the layout, the tokens and the four home components.** Each component stays under 50 lines per function.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm build`. Expected: build succeeds and `out/index.html` exists.
- [ ] **Step 3: Verify in the browser.** Run `preview_start { name: 'aggie-dev' }`.
  - At 1280px and at 375px (the `mobile` preset), in light and dark: the five lines read Final. The 2026 note shows. The Compound U18 Men card shows `Tie for 1st`. `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 375px.
  - `/?preview=2-12`: Sat 1:00 PM reads `Shooting now · End 12 of 20 · JOAD line` (60-arrow event, so `ends` is 20), Sat 6 PM and Sun 9 AM read `Upcoming`, and Recurve Senior Men reads `Provisional · 15 of 30 still to shoot`.
  - Network: one `tournament_score_list` request at load, one about every 20s after that, and none while the tab is hidden.
  - Console: no errors.
  - Take a screenshot for Michael.
- [ ] **Step 4: Commit**: `"Home page: line strip, podium cards and archer search"`

---

### Task 8: Division board and scorecard

**Files:** Create `app/division/page.tsx`, `app/division/division-board.tsx`, `app/components/scorecard-modal.tsx`.

**Interfaces:**
- Consumes: `useEventData`, `buildEventView`, `fetchScorecard`, `loadFrozenCard`, `CURRENT_EVENT`, `archiveConfig`.
- Produces: the route `/division/?d=<slug>[&y=<year>][&a=<shooterId>]`. With no `y`, it uses `CURRENT_EVENT`. With a `y`, it uses that archive year (not live).

Board:
- A `← All divisions` link, the label, a status badge, and `{count} archers`.
- Columns: `#`, `Archer` (name, with `{line label} · {target}` underneath, and the line tag when set), one column per round, `Total`, `10s`, `9s`. Round columns come from the division's own `rounds.length`: two rounds are headed `1st 30` and `2nd 30`; any other count is headed `R1`, `R2`, … (the 2022 Double FITA shows four). Derive the count from the first row with arrows, falling back to 2.
- Under 480px, hide the per-round columns and `9s`.
- Rows with 0 arrows show `—` and are muted.
- `a` highlights that archer's row and scrolls to it.
- An unknown slug shows `Division not found` with a link home.

Scorecard modal:
- Name, then `{division label} · {line label} · Target {target}`, then Total, 10s and 9s.
- A grid of ends, each with its number, arrows, end score and running total.
- Escape or an overlay click closes it.
- Loading text is `Loading scorecard…`. The error text is `Couldn't load this scorecard. Try again.`
- Frozen years use `loadFrozenCard`. Live years use `fetchScorecard`.

- [ ] **Step 1: Build the board and the modal.**
- [ ] **Step 2: Run** `pnpm typecheck && pnpm build`. Expected: success.
- [ ] **Step 3: Verify in the browser.**
  - `/division/?d=recurve-senior-men` lists 30 archers, and D'Amour reads `Sat 1:00 PM · 23B · JOAD line`.
  - Tap D'Amour: 20 ends, the last running total is 587, and Escape closes the modal.
  - At 375px there is no page scroll and the visible columns are `#`, `Archer`, `Total`, `10s`.
  - `/division/?d=nope` shows `Division not found`.
- [ ] **Step 4: Commit**: `"Division leaderboard and end-by-end scorecard"`

---

### Task 9: Past results (2022–2025)

**Files:**
- Create: `app/past/[year]/page.tsx`
- Create (generated): `public/data/{2025,2024,2023,2022-double-fita,2022-joad}.json` and the matching `-cards.json`

**Interfaces:**
- Consumes: `HomeView` (Task 7), `YEARS`, `archiveConfigs` (Task 12), `loadFrozen` (Task 6).
- `generateStaticParams` returns every `YEARS` entry's year as a string.
- For a year with ONE tournament, the page renders `HomeView` exactly as the live page does, with that tournament's archive config and `note: null`. Lines come from `deriveLines`.
- For a year with MORE than one tournament (2022), the page renders one `HomeView` per tournament in `YEARS` order, each under an `<h2>` naming it (`Double FITA · 120 arrows`, `JOAD · 60 arrows`) and each with its own line strip and podiums. Division links carry `&t=<slug>` so Task 8 loads the right tournament.
- The year tab strip comes from Task 12's `YearTabs`, so it is identical on every page.

- [ ] **Step 1: Freeze the archive.** Run `pnpm freeze <slug>` for each remaining slug (2024, 2023, 2022-double-fita, 2022-joad). Expected: `2025: 512 archers, 468 scorecards`, `2024: 517 archers, …`, `2023: 493 archers, …`, `2022-double-fita: 204 archers, …`, `2022-joad: 104 archers, …`.
- [ ] **Step 2: Build the page.** Run `pnpm build`, and check that `out/past/2024/index.html` and `out/past/2022/index.html` exist.
- [ ] **Step 3: Verify in the browser.**
  - `/past/2024/` shows six derived lines, starting with `Fri 1:00 PM`, and the 2024 podiums. Its division labels read `Compound U15 Men`, not `Compound U15 Cub Male`.
  - `/past/2022/` shows BOTH sections. The Double FITA board has four round columns and its champion reads `Sawyer Sullivan 1185`; the JOAD board has two round columns and its champion reads `Ryan Booth 583`. No division shows a raw lowercase name.
  - Tapping an archer on any archive year opens a scorecard with no request to `api.eyesonscore.com`.
  - The year tabs switch between 2022, 2023, 2024 and 2025, and the current year's tab is marked.
  - At 375px there is no horizontal page scroll on `/past/2022/`.
- [ ] **Step 4: Commit**: `"Past results for 2022 through 2025 with a year tab switcher"`

---

### Task 10: Ship to aggieinvite.eyesonscore.com

**Files:** Modify `.github/workflows/deploy.yml` and `README.md`. Create `public/CNAME`. Delete `site/`.

- [ ] **Step 1: Update the deploy workflow.** Replace the placeholder build job with the reference repo's job: pnpm setup `10.33.0`, Node 20 with the pnpm cache, `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, then upload `./out`. Write `public/CNAME` as `aggieinvite.eyesonscore.com`. Run `git rm -r site`.
- [ ] **Step 2: Add "Event-day steps" to `README.md`**, word for word:
  1. **2026 tournament exists in EOS:** set `EVENT_2026.tournamentId`, set `CURRENT_EVENT = EVENT_2026`, and push.
  2. **A line won't close** (an archer stopped mid-round on Sunday): add its key to `closedLines` and push.
  3. **Shoot-off decided:** add `shootOffs: { '<EOS division name>': ['<winner>', '<runner-up>'] }` and push.
  4. **After awards:** run `pnpm freeze 2026`, set `EVENT_2026.live = false`, add 2026 to `ARCHIVE`, and push.
  5. **A push didn't deploy:** run `gh workflow run "Deploy to GitHub Pages" --ref main`.
- [ ] **Step 3: Run** `pnpm test && pnpm typecheck && pnpm build`. Expected: all pass, and `out/CNAME`, `out/data/2025.json` and `out/division/index.html` exist.
- [ ] **Step 4: Commit**: `"Deploy the live app in place of the placeholder"`
- [ ] **Step 5: Ask Michael for the OK to push.** Do not push without it. Then run `git push`, and watch with `gh run watch`. If no run starts, dispatch it as in step 2.
- [ ] **Step 6: Verify live.**
  - `curl -s https://aggieinvite.eyesonscore.com/` contains `Aggie Invitational`.
  - In the browser, the home page loads 2025 from EOS, and one QR code (`qr/aggieinvite-qr-black.png`, decoded) opens the same page.
  - `http://` redirects to `https://`.

---

### Task 11 (stretch): Awards mode

**Files:** Create `app/awards/page.tsx`, `app/awards/awards-view.tsx`, `src/lib/awards.ts`. Test `src/lib/awards.test.ts`.

**Interfaces:**
- Produces: `awardsOrder(view: EventView): DivisionView[]` (divisions with `shot > 0`, in `compareDivisions` order, until the club supplies its own order) and `stepIndex(i: number, n: number, key: string): number`.
- The route is `/awards/`, with no nav link.
- Each slide shows `Award {i} of {n}`, the division label, a podium laid out 2-1-3 with names and totals, and the tie note while a tie is unresolved.
- Keys: `ArrowRight`, `' '` and `PageDown` go forward. `ArrowLeft` and `PageUp` go back. `Home` jumps to the first. A click goes forward.

- [ ] **Step 1: Write the failing tests.** `stepIndex(0, 49, 'ArrowLeft') === 0`, `stepIndex(48, 49, 'ArrowRight') === 48`, `stepIndex(3, 49, ' ') === 4` and `stepIndex(7, 49, 'Home') === 0`. With the 2025 view, `awardsOrder` has length 48 and its first label is `'Recurve U13 Women'`. (48 because Para Compound Senior Men has no scores.)
- [ ] **Step 2: Run** `pnpm test src/lib/awards.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `awards.ts` and the page.
- [ ] **Step 4: Run** `pnpm test`, then verify at 1280×720: stepping to Compound Senior Women shows Brooks 595, Krahe 583 and Moore 576.
- [ ] **Step 5: Commit**: `"Awards mode for the Sunday ceremony"`. Push only with Michael's OK.

---

### Task 12: Amend the data layer for every year (Amendment A)

Do this BEFORE Task 4. It changes already-built, already-reviewed code from Tasks 1, 2 and 3.

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/eos-schema.ts`, `src/lib/eos-schema.test.ts`, `src/lib/divisions.ts`, `src/lib/divisions.test.ts`, `src/config/event.ts`, `src/lib/schedule.test.ts`
- Create: `src/test/fixtures/aggie-2022-double-fita-score-list.json`, `app/components/year-tabs.tsx`
- Test: the three existing test files above

**Interfaces:**
- `ArcherRow` loses `half1` and `half2` and gains `rounds: number[]` — every `round_N` key present on the row, in numeric order. `total` stays `total_score`.
- `src/config/event.ts` gains:
  ```ts
  export interface ArchiveTournament { slug: string; id: string; name: string; sectionLabel: string | null }
  export interface ArchiveYear { year: number; label: string; dates: string; tournaments: ArchiveTournament[] }
  export const YEARS: ArchiveYear[]
  export function archiveConfigs(year: number): EventConfig[]   // one per tournament, live:false, lines:[]
  ```
  `archiveConfig(year)` is replaced by `archiveConfigs(year)`; update Task 6's and Task 9's callers. `ARCHIVE` is removed.
- `app/components/year-tabs.tsx` exports `YearTabs({ current }: { current: number | 'live' })`, a server component rendering one link per `YEARS` entry (newest first) plus the live year, marking the current one `aria-current="page"`.

`YEARS` content, exact:
| year | label | dates | tournaments (slug, id, sectionLabel) |
|---|---|---|---|
| 2025 | `2025` | `Nov 7–9, 2025` | `2025`, `QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09`, `null` |
| 2024 | `2024` | `Nov 22–24, 2024` | `2024`, `a0FvWDBhcW1kVnF3bFRRY1lMTWE0dz09`, `null` |
| 2023 | `2023` | `Nov 3–5, 2023` | `2023`, `bVRpazQxQ2NEbGRrQmpqUnR2RzZPUT09`, `null` |
| 2022 | `2022` | `Nov 11–13, 2022` | `2022-double-fita`, `bWkrMXQ2bEhIaHdaVjBveUZQNVYyZz09`, `Double FITA · 120 arrows`; then `2022-joad`, `dFZISWJuT051SkNmb2lkNVB3cVdFQT09`, `JOAD · 60 arrows` |

Each tournament's `name` is its EOS name: `2025 Aggie Invitational`, `2024 Aggie Invitational`, `2023 Aggie Invitational`, `Aggie Invitational - Double FITA`, `Aggie Invite - JOAD`.

**Division parsing changes** (`divisions.ts`): matching becomes case-insensitive, and the age may appear either after the class word or before it. Drop the class words `Cub`, `Bowman`, `Cadet`, `Junior`, `Trophy` wherever they sit, then take the first remaining word that is a known age. 2022 writes names like `barebow (recurve) bowman u13 female` and `compound trophy cub u15 male`; 2024 writes `Compound U15 Cub Male`. Both must give the same label.

- [ ] **Step 1: Capture the 2022 fixture.** From the worktree root:
  ```bash
  TOK=$(sed -n "s/^const TOKEN = '\(.*\)'$/\1/p" src/lib/eos.ts)
  curl -s -X POST -H "Authorization: $TOK" "https://api.eyesonscore.com/api/tournament_score_list?is_private=false&id=bWkrMXQ2bEhIaHdaVjBveUZQNVYyZz09&for_fav=true" -o src/test/fixtures/aggie-2022-double-fita-score-list.json
  ```
  Expected: the file starts `{"status_code":200`.
- [ ] **Step 2: Write the failing tests.**
  - `eos-schema.test.ts`: D'Amour's row now asserts `rounds: [292, 295]` in place of `half1`/`half2`, with `total: 587` unchanged. New test: parsing the 2022 Double FITA fixture gives 204 rows and 43 divisions, and Sawyer Sullivan's row has `rounds: [299, 291, 298, 297]`, `total: 1185`, `arrowsDue: 120`, and `rounds.reduce((a, b) => a + b, 0) === 1185`.
  - `divisions.test.ts`: `'barebow (recurve) bowman u13 female'` gives label `Barebow U13 Women` and slug `barebow-u13-women`; `'compound trophy cub u15 male'` gives `Compound U15 Men`; `'Compound U15 Cub Male'` still gives `Compound U15 Men` (same label from both spellings). Every division in the 2022 fixture parses with `known: true`.
  - `schedule.test.ts`: `archiveConfigs(2022)` returns 2 configs whose slugs are `['2022-double-fita', '2022-joad']`; `archiveConfigs(2025)` returns 1; `archiveConfigs(2019)` returns `[]`. `YEARS` covers 2022–2025.
- [ ] **Step 3: Run** `pnpm test`. Expected: FAIL on the new assertions.
- [ ] **Step 4: Implement** the `rounds` change, the division-parsing change, the `YEARS` / `archiveConfigs` change, and `YearTabs`. Update every existing caller so the suite is green.
- [ ] **Step 5: Run** `pnpm test && pnpm typecheck`. Expected: all pass, output pristine.
- [ ] **Step 6: Commit**: `"Support every archive year, including the 2022 Double FITA"`
