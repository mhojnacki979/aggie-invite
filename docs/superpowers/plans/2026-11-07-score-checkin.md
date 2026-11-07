# Score Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in `/checkin/` page where the TD's crew picks a shooting time, taps a bale, sees that
bale's archers and scores, and marks the bale checked. Checks are shared live through Supabase.

**Architecture:** Pure bale logic in `src/lib/checkin.ts` (tested, moves to new EOS `packages/shared`).
Checkmarks live behind a `CheckStore` interface: a Supabase implementation now, an in-memory one for tests,
and an EOS API one later. Auth sits behind a three-function module. The UI lives under `app/checkin/` and
reuses `useEventData`, `buildEventView`, `roundScore`, `ScorecardModal` and `useScorecard`.

**Tech Stack:** Next 15 static export, React 19, TypeScript, zod, Vitest (node env, `src/**/*.test.ts`),
`@supabase/supabase-js` v2.

**Spec:** `docs/superpowers/specs/2026-11-07-score-checkin-design.md`

## Global Constraints

- **Supabase project:** `aggie-checkin`. URL `https://josfssiwxtskqbtfeerz.supabase.co`, publishable key
  `sb_publishable_STXMx6c--bQRhjZVg59hjA_WxqpE-WJ`. Both are public by design and committed in
  `src/config/checkin.ts`. The service-role key never goes in the repo.
- **Table** `public.bale_checks(tournament_id text, line_key text, bale int > 0, checked_at timestamptz,
  checked_by text default 'crew')`, primary key `(tournament_id, line_key, bale)`.
  - RLS allows select, insert and delete for `authenticated` only. The table is in the
    `supabase_realtime` publication.
- **Bundles:** supabase-js is imported only from `src/lib/checkin-supabase.ts` and `app/checkin/**`. No
  public page may import either.
- **Not touched:** `src/config/event.ts`, and no public-page behavior changes.
- **Copy (exact):**
  - Title: "Aggie Invitational · Score check-in"
  - Signed-in line: "Signed in as crew", with a "Sign out" link
  - Legend: "Still shooting" / "Ready to check" / "Checked"
  - Button: "✓ Mark bale {n} checked"
  - Confirm: "Not everyone on this bale has finished. Mark it checked anyway?"
  - After checking: "Checked by crew at {h:mm AM} · Undo"
  - Progress: "{c} of {n} bales checked · {r} ready · {s} still shooting"
- **Code style:** no `any`, functions under 50 lines, functional React components. Commit messages describe
  the change plainly, with no MFH prefix and no Co-Authored-By.
- **Repo rule:** don't push or merge without Michael's explicit go-ahead.

## Review Focus

1. **Target strings EOS writes oddly** (`14 b`, ``, `B14`, `140D`). Expected: a valid one parses to bale and
   position, anything else lands in "No bale" and isn't dropped. *Test:* Task 1 `parseTarget` cases.
2. **Two tablets check the same bale at once.** Expected: both end up showing it checked, with no error
   shown. *Test:* Task 2 `memoryStore` check twice is idempotent. The Supabase store treats error code
   `23505` as success.
3. **A bale with a withdrawn archer, who will never be done.** Expected: it reads "still shooting" but can
   still be checked after the confirm. *Test:* Task 1 `baleStatus` with a not-done archer and a check
   returns `checked`.
4. **Realtime socket drops** (tablet sleeps). Expected: on visibility return or reconnect, the page refetches
   the full list, so it's never stale. *Covered* by Task 3 `useBaleChecks` refetch on `visibilitychange`.
   Verified manually in Task 5.
5. **Signed-out writes.** Expected: inserting with only the publishable key fails under RLS. *Verified* in
   Task 5 with a direct REST call using no session.

---

### Task 1: Bale logic (`src/lib/checkin.ts`)

**Files:**
- Create: `src/lib/checkin.ts`
- Test: `src/lib/checkin.test.ts`

**Interfaces:**
- Consumes:
  - `EventView`, `DivisionView`, `LineView` and `isDone(row)` from `src/lib/status.ts`
  - `ArcherRow` from `src/lib/types.ts`
- Produces:
  ```ts
  export interface BaleSeat { row: ArcherRow; division: DivisionView; position: string }  // 'A'…
  export interface Bale { number: number | null; seats: BaleSeat[] }  // null = "No bale"
  export type BaleStatus = 'shooting' | 'ready' | 'checked'
  export interface LineProgress { total: number; checked: number; ready: number; shooting: number }
  export function parseTarget(target: string): { bale: number; position: string } | null
  export function balesForLine(view: EventView, lineKey: string): Bale[]  // by number asc, "No bale" last; seats by position
  export function baleStatus(bale: Bale, checked: boolean): BaleStatus
  export function lineProgress(bales: Bale[], checkedBales: ReadonlySet<number>): LineProgress  // "No bale" excluded from all counts
  export function defaultLineKey(view: EventView): string | null  // first line with status 'shooting', else the last line with any arrows, else the first line, else null
  ```

- [ ] **Step 1: Write the failing tests** (`checkin.test.ts`, building rows the way `favorites.test.ts` does)
  - `parseTarget`:
    - `'14B'` gives `{bale:14, position:'B'}`.
    - `'14 b'` gives `{bale:14, position:'B'}`.
    - `'7A'` gives `{bale:7, position:'A'}`.
    - `''`, `'B14'`, `'14'` and `'0A'` give `null`.
  - `balesForLine`:
    - Groups only the archers whose `view.lineByShooter[id].key === lineKey`.
    - Bales are sorted by number. Seats are sorted A, B, C, D, whatever the input order.
    - An archer with target `''` lands in a final bale whose number is `null`.
  - `baleStatus`:
    - All seats `isDone` gives `'ready'`.
    - One seat with `arrowsShot < arrowsDue` gives `'shooting'`.
    - With `checked = true`, a shooting bale gives `'checked'`.
  - `lineProgress`: 3 bales (one checked, one ready, one shooting) plus a "No bale" give
    `{total:3, checked:1, ready:1, shooting:1}`.
  - `defaultLineKey`:
    - Returns the line whose status is `'shooting'` when there is one.
    - With none shooting, returns the last line with `endsShot > 0`.
- [ ] **Step 2:** Run `pnpm test src/lib/checkin.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/lib/checkin.ts`** with the signatures above. Regex: `/^(\d+)\s*([A-Za-z])$/`,
  bale must be > 0, position upper-cased.
- [ ] **Step 4:** Run `pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit:** "Group archers into bales by shooting time for score check-in".

### Task 2: Checkmark store (interface, memory, Supabase)

**Files:**
- Create: `src/lib/checkin-store.ts` (interface + `createMemoryStore`)
- Create: `src/lib/checkin-supabase.ts` (Supabase client, `supabaseStore`, auth functions)
- Create: `src/config/checkin.ts` (`CHECKIN_SUPABASE_URL`, `CHECKIN_SUPABASE_KEY`)
- Test: `src/lib/checkin-store.test.ts`
- Modify: `package.json` / `pnpm-lock.yaml` (add `@supabase/supabase-js`)

**Interfaces:**
- Produces:
  ```ts
  export interface BaleCheck { lineKey: string; bale: number; checkedAt: string; checkedBy: string }
  export interface CheckStore {
    list(tournamentId: string): Promise<BaleCheck[]>
    check(tournamentId: string, lineKey: string, bale: number): Promise<void>   // idempotent
    uncheck(tournamentId: string, lineKey: string, bale: number): Promise<void>
    subscribe(tournamentId: string, onChange: () => void): () => void            // returns unsubscribe
  }
  export function createMemoryStore(): CheckStore
  // checkin-supabase.ts
  export const supabaseStore: CheckStore
  export function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }>
  export function signOut(): Promise<void>
  export function onAuthChange(cb: (signedIn: boolean) => void): () => void  // fires once with current state
  ```

- [ ] **Step 1: Failing tests for `createMemoryStore`:**
  - `check` then `list` returns that bale with `checkedBy:'crew'`.
  - `check` twice on the same bale gives one entry, with no throw.
  - `uncheck` removes it.
  - `subscribe` callback fires on `check` and `uncheck`, and stops after unsubscribe.
  - A different `tournamentId` is invisible.
- [ ] **Step 2:** `pnpm test src/lib/checkin-store.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `createMemoryStore`.**
- [ ] **Step 4:** `pnpm add @supabase/supabase-js@^2`. Write `src/config/checkin.ts` with the values from
  Global Constraints.
- [ ] **Step 5: Implement `checkin-supabase.ts`.**
  - One `createClient` with `auth: { persistSession: true }`.
  - `list` selects by `tournament_id` and validates rows with zod.
  - `check` inserts, and treats error code `23505` as success.
  - `uncheck` deletes by the full key.
  - `subscribe` opens a channel on `postgres_changes` (`event: '*'`, `table: 'bale_checks'`,
    `filter: tournament_id=eq.{id}`) and calls `onChange`. Unsubscribe removes the channel.
  - The auth functions wrap `supabase.auth`.
  - Map row `{line_key, bale, checked_at, checked_by}` to a `BaleCheck`.
- [ ] **Step 6:** `pnpm test && pnpm typecheck`. Expected: pass.
- [ ] **Step 7: Commit:** "Add a shared checkmark store for score check-in (Supabase now, swappable for EOS)".

### Task 3: Check-in hooks

**Files:**
- Create: `app/checkin/use-bale-checks.ts`

**Interfaces:**
- Consumes: `CheckStore` (Task 2).
- Produces:
  ```ts
  export function useBaleChecks(store: CheckStore, tournamentId: string, enabled: boolean): {
    checked: (lineKey: string, bale: number) => BaleCheck | undefined
    check: (lineKey: string, bale: number) => Promise<void>
    uncheck: (lineKey: string, bale: number) => Promise<void>
    error: string | null
  }
  ```
- [ ] **Step 1: Implement the hook.**
  - When `enabled`, it runs `list` on mount.
  - It refetches the full list on every `subscribe` callback, on `visibilitychange` to visible, and on
    `online`.
  - `check` and `uncheck` call the store, then refetch.
  - Failures set `error` ("Couldn't save. Check the connection and try again.") and never throw.
- [ ] **Step 2:** `pnpm typecheck`. Expected: pass. Commit with the Task 4 UI.

### Task 4: The `/checkin/` page

**Files:**
- Create: `app/checkin/page.tsx` (metadata `robots: { index: false, follow: false }`, title "Score check-in")
- Create: `app/checkin/checkin-view.tsx` (auth gate + layout)
- Create: `app/checkin/sign-in.tsx`
- Create: `app/checkin/bale-grid.tsx`
- Create: `app/checkin/bale-panel.tsx`
- Create: `app/checkin/checkin.css`

**Interfaces:**
- Consumes:
  - Task 1 functions.
  - Task 2 `supabaseStore`, `signIn`, `signOut` and `onAuthChange`.
  - Task 3 hook.
  - `CURRENT_EVENT` (read only) and `useEventData` from `src/lib/use-event-data.ts`.
  - `buildEventView`.
  - `roundScore` / `roundCountOf` from `src/lib/board-columns.ts`.
  - `ScorecardModal` and `useScorecard`.

- [ ] **Step 1: `checkin-view.tsx`.**
  - Before `onAuthChange` reports, render nothing.
  - Signed out: render `<SignIn/>`.
  - Signed in:
    - The top bar uses the exact copy.
    - The time `<select>` lists `view.lines`, labelled with `line.label` plus the tag when there is one.
      It defaults to `defaultLineKey(view)`, and the user's choice is kept in state.
    - The progress line and legend use the exact copy.
    - Then `<BaleGrid>` and `<BalePanel>`.
  - The data poll runs only while signed in (`useEventData(config, false)` sits inside the signed-in
    child component).
- [ ] **Step 2: `sign-in.tsx`.**
  - Email and password inputs (`autocomplete` `username` / `current-password`) and a "Sign in" button.
  - Shows the Supabase error message on failure.
- [ ] **Step 3: `bale-grid.tsx`.**
  - One `<button>` per bale, labelled with its number, or "No bale".
  - A class per `baleStatus`: tan for ready, green for checked, grey for shooting, using the
    `--prov-bg`/`--final-bg`/`--done-bg` tokens.
  - `aria-pressed` on the selected tile, and an `aria-label` of "Bale 14, ready to check".
- [ ] **Step 4: `bale-panel.tsx`.**
  - Heading "Bale {n}". Subtitle "{line label} · all {k} archers finished" or "{d} of {k} finished".
  - Table columns: position, name and division label, 1st 30 and 2nd 30 (`roundScore`, dash for null),
    Total, 10s, 9s. "End {endsShot} of {endsDue}" under a name whose archer isn't done, computed as
    floor(arrows / 3).
  - Each row button opens `ScorecardModal` through `useScorecard(config)`.
  - The check button:
    - Uses `window.confirm` with the exact confirm text when the status isn't `ready`.
    - Once checked, shows "Checked by crew at {time} · Undo", with time from `toLocaleTimeString` at
      `en-US`, `{hour:'numeric', minute:'2-digit'}`.
  - "No bale" shows its archers with no button.
- [ ] **Step 5: `checkin.css`.**
  - Grid of 52px tiles, side by side with the panel at ≥ 760px and stacked below that.
  - Dark mode comes from the existing tokens.
- [ ] **Step 6:** `pnpm test && pnpm typecheck && pnpm build`. Expected: pass.
- [ ] **Step 7: Bundle check.** Grep `out/_next/static/chunks/app/page-*.js` and
  `out/_next/static/chunks/app/division/*.js` for `supabase`. Expected: no matches.
- [ ] **Step 8: Commit:** "Add the score check-in page for the TD's table".

### Task 5: Verify and document

- [ ] **Step 1: Run the dev server** (launch config `aggie-split`) and sign in with a throwaway test user.
  Create it through the Supabase dashboard, or with an SQL-free path Michael approves, and delete it after.
- [ ] **Step 2: Check the screen** against live EOS data at 375px and 1024px:
  - The time dropdown works.
  - Tile colors match each bale's state.
  - The panel numbers match the public division board.
  - The scorecard opens.
- [ ] **Step 3: Two windows signed in.**
  - Check a bale in one, and it turns green in the other within about 2 s.
  - Undo it, and it returns.
  - Hide the tab, check a bale from the other window, show the tab again, and it's current.
- [ ] **Step 4: Signed-out write is refused.** `curl` POST to `/rest/v1/bale_checks` with only the
  publishable key. Expected: 401/403 RLS error, no row.
- [ ] **Step 5: Supabase advisors.** Run the `security` advisors. Expected: no lints.
- [ ] **Step 6: README.** Add an "Event-day steps" entry: "Score check-in: open /checkin/ on the table
  tablets and sign in with the crew login". Point to the design doc.
- [ ] **Step 7: Commit, then review.** Run an independent review of the branch. Push and open a PR only on
  Michael's go-ahead.
