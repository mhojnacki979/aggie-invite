# Score check-in: design

*2026-11-07. Agreed with Michael in chat. Built first for the 2026 Aggie Invitational (aggie-invite repo),
then moved into the new EOS.*

## Why

When a shooting time ends, archers bring their paper scorecards to the TD's table. The person at the table
has to find each archer's score on the website to confirm it. At an indoor event, archers sign up for a
**time**, not a division slot, so today the checker first has to work out each archer's division, then click
through to that division's board, then find the archer. With 25+ bales coming in at once, that chasing is
what slows the table down.

The fix is one screen that the TD's crew works from. They pick the time, tap the bale, and see every archer
on that bale with their scores. Once each archer's paper matches, they mark the bale checked. The scores on
screen are the record. **Archers correct their paperwork to match before the score is accepted.**

Success: two or more checkers at the table can clear a bale without leaving the screen, and the TD can see
at a glance which bales for a time are still outstanding.

## Goals

- Pick a shooting time from a dropdown, then tap a bale to see only that bale's archers and scores.
- Bale tiles show where each bale stands: still shooting, ready to check, or checked.
- Mark a bale checked, or undo it. The checkmark shows on every signed-in device within a few seconds.
- Only the crew can use the page (a sign-in), and only signed-in users can change checkmarks.
- Build it so the logic and data model move into the new EOS with no rework (see "Moving into the new EOS").

## Non-goals

- Editing scores. Corrections still happen in EOS, and this screen only reads.
- Separate logins per person. Michael chose one shared crew login, so "checked by" records `crew`.
- Paper card photos, printing, signatures.
- Changing anything on the public pages.

## Anti-goals (would make this a failure even if it works)

- Anything that can slow down or break the live public site mid-event. The check-in page must be a separate
  route whose code the public pages never load.
- Checkmarks that disagree between the two tablets (one shows bale 14 checked, the other doesn't).
- A sign-in that lets the public change checkmarks.

## Decided (by Michael)

| Decision | Choice |
|---|---|
| Who uses it | The TD and his crew at the scoring table, after a time finishes |
| Entry point | Time dropdown first, then a visual bale grid, then the bale's archers |
| Source of truth | The scores on screen (EOS). Archers fix their paper to match |
| Tracking | A bale is ticked off and its tile changes color |
| Devices | Two checkers now, maybe more. Checkmarks must be shared live |
| Where | A subsection of aggieinvite.eyesonscore.com |
| Login | One shared crew login |
| Backend for this weekend | Option A: a hosted database with sign-in (Supabase), coded to fold into the new EOS |
| A score changes after its bale is checked | Leave it checked |
| Screen | The approved mockup: dropdown and progress line on top, bale grid on the left, bale panel on the right (stacked on a phone) |

## The screen

Route: `/checkin/` on aggieinvite.eyesonscore.com. It isn't linked from any public page and is marked
`noindex`.

1. **Signed out:** a sign-in form (email and password) and nothing else. The bale grid doesn't load until sign-in succeeds.
2. **Top bar:** "Aggie Invitational · Score check-in", "Signed in as crew", and a Sign out link.
3. **Time dropdown:** one entry per configured line (`EVENT_2026.lines`, labels like "Sat 8:00 AM"), plus
   an "Other" entry only if some archers matched no line. Next to it is a progress line, for example
   "9 of 26 bales checked · 12 ready · 5 still shooting".
4. **Bale grid:** one tile per bale used on that time, in bale-number order.
   - **Grey, "still shooting":** at least one archer on the bale hasn't shot all their arrows.
   - **Tan, "ready to check":** every archer on the bale has shot all their arrows (`isDone` in `status.ts`).
   - **Green, "checked":** a checkmark exists for this bale and time. This wins over the other two.
   - The selected tile gets a maroon outline.
5. **Bale panel**, for the selected bale:
   - The heading is "Bale 14". The subtitle is the time plus "all 4 archers finished" or "2 of 4 finished".
   - One row per archer, sorted by position letter: position (A–D), name, division, 1st 30, 2nd 30, Total,
     10s, 9s. An archer who isn't done gets a small "End 18 of 20" note.
   - Tapping an archer opens the existing end-by-end scorecard popup (`ScorecardModal` + `useScorecard`).
   - **"✓ Mark bale 14 checked"** button. If the bale isn't ready, tapping it asks "Not everyone on this
     bale has finished. Mark it checked anyway?" Withdrawn archers mean this has to stay possible.
   - Once checked, the button area reads "Checked by crew at 11:42 AM · Undo". Undo removes the checkmark.
6. **Phone width:** the grid sits above the panel. Tablet and laptop: side by side, as in the mockup.

### Where the bale comes from

EOS gives every archer a `target` such as `14B`: bale 14, position B. Parse it with `^(\d+)\s*([A-Za-z])$`,
which gives the bale number and the position in upper case. An archer whose target doesn't parse goes into a
"No bale" tile at the end of the grid, so nobody silently disappears. The time comes from the line the archer
is already assigned to (`buildEventView(...).lineByShooter`, keyed by EOS session date and time).

Scores, rounds and done-ness all come from the same `ArcherRow` data the public site already fetches
(`useEventData` → `fetchScoreList`). The page polls EOS exactly as the public pages do (every 20 s,
paused in a hidden tab). It adds no new EOS endpoints and no extra request pattern.

## Shared checkmarks (Supabase)

### Project

A new Supabase project, `aggie-checkin`, in Michael's existing organization. It gets its own project rather
than a table inside an unrelated app's database. Supabase quoted **$0/month** for a new project in this
organization on 2026-11-07. Repeat that to Michael before creating it.

### Table

```sql
create table public.bale_checks (
  tournament_id text        not null,  -- EOS tournament id (EVENT_2026.tournamentId)
  line_key      text        not null,  -- e.g. '11-07-2026 08:00 AM' (LineConfig.key)
  bale          integer     not null,  -- 14
  checked_at    timestamptz not null default now(),
  checked_by    text        not null default 'crew',
  primary key (tournament_id, line_key, bale)
);

alter table public.bale_checks enable row level security;

create policy "crew can read"   on public.bale_checks for select to authenticated using (true);
create policy "crew can check"  on public.bale_checks for insert to authenticated with check (true);
create policy "crew can undo"   on public.bale_checks for delete to authenticated using (true);

alter publication supabase_realtime add table public.bale_checks;
```

- **Checking a bale** is an insert. If the bale is already checked, the primary key rejects the second
  insert. Treat that as success: the bale is checked either way. This is what keeps two tablets from
  disagreeing.
- **Undo** is a delete of that one row.
- **The "No bale" tile can't be checked:** there is no bale number to store.
- No updates and no other tables.
- **A score corrected in EOS after its bale is checked leaves the checkmark alone.** The bale stays green
  (Michael, 2026-11-07). No score fingerprint is stored with a check.

### Sign-in

- **The account:** Supabase Auth, email and password, one user: the crew account. **Michael creates it
  himself** in the Supabase dashboard (Authentication → Users → Add user, auto-confirm on), so the password
  never passes through chat or the repo. He gives the password to the crew in person.
- **Sign-ups and email (Michael, in the same dashboard visit):** turn **off** "Allow new users to sign up"
  under Authentication → Sign In / Providers. Until it's off, anyone holding the public key could register
  and get past RLS, so the page doesn't go live before this is done. No emails are sent, so email
  deliverability doesn't matter.
- **Session:** supabase-js keeps the session in the browser, so a tablet stays signed in across reloads
  until someone taps Sign out.
- **What the login protects:** the scores themselves are public already. The sign-in exists so that only
  the crew can see the screen and change checkmarks, and Row Level Security enforces the second part on the
  server.

### Keys and config

- **What goes in the browser:** the site is a static export, so the project URL and the **publishable
  (anon) key** ship in the browser bundle. They're public by design, and RLS is the protection.
- **Where they live:** commit them in a small config file, `src/config/checkin.ts`. That avoids adding
  GitHub secrets and keeps the build reproducible.
- **What never goes in the repo:** the service-role key.

### Live updates

Subscribe to Postgres changes on `bale_checks`, filtered by `tournament_id`, for inserts and deletes. Apply
each change to local state. On subscribe, on reconnect and when the tab becomes visible again, refetch the
full list for the tournament. That way a dropped socket can't leave a tablet stale. The target is for a
checkmark made on one tablet to show on the other within about 2 seconds.

## Code shape (built to move into the new EOS)

- **Pure logic in `src/lib/checkin.ts`, with Vitest tests:**
  - `parseTarget(target)` returns `{ bale, position } | null`.
  - `balesForLine(view, lineKey)` returns bales with their archers, sorted by position.
  - `baleStatus(bale, checked)` returns `'shooting' | 'ready' | 'checked'`.
  - `lineProgress(...)` returns the counts for the progress line.

  None of it knows about Supabase or React. This file moves into the new EOS's `packages/shared` as is.
- **A storage interface in `src/lib/checkin-store.ts`:**
  ```ts
  interface BaleCheck { lineKey: string; bale: number; checkedAt: string; checkedBy: string }
  interface CheckStore {
    list(tournamentId: string): Promise<BaleCheck[]>
    check(tournamentId: string, lineKey: string, bale: number): Promise<void>
    uncheck(tournamentId: string, lineKey: string, bale: number): Promise<void>
    subscribe(tournamentId: string, onChange: () => void): () => void
  }
  ```
  - `supabaseStore` implements it for this weekend.
  - An in-memory store implements it for tests.
  - The new EOS adds an `eosApiStore` that implements the same interface with its REST endpoints and
    Socket.IO.
- **Auth behind a small interface in `src/lib/checkin-auth.ts`:** `signIn`, `signOut`, `session`, `onChange`.
- **UI in `app/checkin/`:** page, bale grid, bale panel and sign-in form. It reuses `useEventData`,
  `buildEventView`, `roundScore`, `ScorecardModal` and `useScorecard`.
- **One new dependency:** `@supabase/supabase-js`. Only the `/checkin` route imports it, so the public
  pages' bundles don't change.

## Moving into the new EOS

The new EOS already has what this needs:
- `Shooter.targetPosition` (for example `10A`; MFH-278 seats it from the CSV bale column).
- `Shooter.slotId` → `TournamentSlot` (the time).
- Per-arrow scores in `ShooterScore`, organizer auth with admin approval (MFH-255), and Socket.IO for live
  updates.

Bales are already derived from seating, not stored (schema comment on `TournamentLine`). The move:

1. **Model:**
   ```prisma
   model BaleCheck {
     id           Int       @id @default(autoincrement())
     tournamentId Int       @map("tournament_id")
     slotId       Int       @map("slot_id")
     bale         Int
     checkedAt    DateTime  @default(now()) @map("checked_at")
     checkedById  Int       @map("checked_by_id")   // the organizer or staff user
     tournament   Tournament     @relation(fields: [tournamentId], references: [id])
     slot         TournamentSlot @relation(fields: [slotId], references: [id])
     checkedBy    User           @relation(fields: [checkedById], references: [id])
     @@unique([tournamentId, slotId, bale])
     @@map("bale_checks")
   }
   ```
   Undo is a hard delete, the same as here. Keep it simple unless an audit trail is wanted.
2. **API (Fastify, organizer-auth, Zod-validated):**
   - `GET /tournaments/:tid/bale-checks`
   - `PUT /tournaments/:tid/slots/:sid/bales/:bale/check` (idempotent)
   - `DELETE /tournaments/:tid/slots/:sid/bales/:bale/check`

   On change, emit `bale-check:changed` to the tournament's Socket.IO room.
3. **Shared logic:** move `src/lib/checkin.ts` into `packages/shared`. In EOS, the time is `slotId` (not a
   session-string `line_key`), and the bale and position come from `targetPosition`.
4. **UI:** a "Check-in" page in the organizer portal, available to the tournament's organizers and staff,
   with the same screen. With real per-person accounts there, "checked by" becomes a name. That's the one
   behavior change from the Aggie version.
5. **Switch-over:** EOS ships with no Supabase. The Aggie `supabaseStore` and the `aggie-checkin` project
   are retired once events run on the new EOS.

## Testing

- Unit tests (Vitest, `src/lib/*.test.ts`) for `parseTarget` (`14B`, `14 b`, `7A`, ``, `B14`, `140D`),
  bale grouping, status (ready vs shooting, withdrawn archer, checked wins), progress counts, and the
  in-memory store's idempotent check and undo.
- Manual, against live EOS data on a local build, at phone and tablet width:
  - Sign in, then out.
  - With two browser windows signed in, check and undo bale X and confirm it shows in the other window
    within about 2 s.
  - Check that a public page's bundle contains no supabase code.
  - Confirm that a signed-out request can't insert (RLS), using the anon key with no session.
- `pnpm test`, `pnpm typecheck` and `pnpm build` pass.

## Rollout

- **Goal:** live before the **Sat 6:00 PM** line ends. If that slips, before Sunday 9:00 AM.
- **Order:**
  1. Michael confirms the Supabase cost ($0).
  2. Create the project, table and policies.
  3. Michael creates the crew user and turns off public sign-ups. This blocks go-live.
  4. Build on a branch, then open a PR.
  5. Michael merges, which deploys. He picks when: he merged two PRs mid-event on Nov 7. A deploy replaces
     every hashed chunk, so a visitor whose page is already open can get one failed popup load until they
     reload. Between lines is gentlest.
- **After the event:** keep the project until the move to the new EOS, or pause it. It holds nothing but
  bale numbers and timestamps.

## Left to the builder

- Exact colors and spacing, matched to the site's existing tokens (`--done-bg`, `--prov-bg`, `--final-bg`
  read well for grey, tan and green).
- Which time the dropdown opens on. Suggested: the line currently shooting, or else the most recent line
  with arrows.
- How the tile grid wraps at each width.
