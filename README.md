# Aggie Invitational: live scores and results

Live scoring and results for the Aggie Invitational (Texas A&M Archery), served at
https://aggieinvite.eyesonscore.com from GitHub Pages. Scores come from Eyes on Score (EOS).

Every change below is an edit to `src/config/event.ts`, then a push to `main`. GitHub runs the tests and
builds the site; it goes live a few minutes later. If a test fails, nothing deploys.

## Event-day steps

0. **Before the event, once archers are registered — run the preflight.** This is the check worth doing
   early, because the thing most likely to break is invisible until the first archer is scored:

   ```
   pnpm preflight <the 2026 EOS tournament id>
   ```

   It runs the site's own parsing against the live tournament and tells you whether the five session keys in
   `EVENT_2026.lines` match what EOS actually writes, whether every division name parses, and whether the
   round format is what the page expects. If the session keys don't match, **every archer lands on an
   "Other" line** and the line strip stops meaning anything — the preflight prints the keys EOS really has,
   so you can correct `weekendLines(...)` in `src/config/event.ts` before the event rather than during it.
   Run it again after any config change. It makes one EOS request and changes nothing.

1. **2026 tournament exists in EOS:** set `EVENT_2026.tournamentId` to its EOS id (the same kind of long
   string as `EVENT_2025.tournamentId`), set `CURRENT_EVENT = EVENT_2026`, and push.
2. **A line won't close** (an archer stopped mid-round on Sunday and the line still reads "Shooting now"):
   add its key to `closedLines` on `EVENT_2026` and push. A key is the date and start time exactly as written
   in the line list, for example `closedLines: ['11-08-2026 09:00 AM']`.
3. **A line closed too soon** (an archer's scores are on paper and not yet entered, so the site treats them as a
   no-show and the line and their division read Final): add the line's key to `openLines` on `EVENT_2026`
   and push, for example `openLines: ['11-06-2026 06:00 PM']`. This is the opposite of `closedLines`: a line in
   `openLines` can never read Final, and it wins if the same key is also in `closedLines`. Remove the key
   once the scores are entered. Note what the site shows meanwhile: that line reads "Shooting now" and its
   divisions read Provisional.
4. **Shoot-off decided:** add an entry to `shootOffs` on `EVENT_2026` and push:

   ```ts
   shootOffs: { 'Compound Senior Male': ['Winner Name', 'Runner-up Name'] },
   ```

   - The key is the division name exactly as EOS spells it.
   - List **every** archer who shares that rank, in finish order, not just the top two. A three-way tie needs all
     three names. A partial list is ignored.
   - Each name must match EOS **character for character** (`Nicholas Wonch`, not `Nick Wonch`).
   - Confirm it worked: the division's badge flips from "Tie for 1st" to "Final". If it still says "Tie", the
     entry was ignored. Open the browser console on the site (or run `pnpm dev` and open it) and look for a
     line starting `Shoot-off for ... ignored:`; it says which check failed.
5. **After awards:** run `pnpm freeze 2026` (it saves the results into `public/data/`), then:
   - set `EVENT_2026.live = false`;
   - add 2026 to `YEARS` in `src/config/event.ts`, newest first (above the 2025 entry):

     ```ts
     {
       year: 2026,
       label: '2026',
       dates: 'Nov 6–8, 2026',
       tournaments: [{ slug: '2026', id: '<the EOS id>', name: '2026 Aggie Invitational', sectionLabel: null }],
     },
     ```

   - commit `public/data/2026.json` and `public/data/2026-cards.json` along with the config change, and push.

   Known gap: the past-results page for a year (`/past/2026/`) is built from `YEARS` and does not carry
   `shootOffs`, so once 2026 is no longer the current event its tied divisions show "Tie" again.
6. **A push didn't deploy:** run `gh workflow run "Deploy to GitHub Pages" --ref main`.

## Commands

`pnpm test`, `pnpm typecheck`, `pnpm build`. `pnpm dev` serves the site at http://localhost:3100.

`node scripts/site-audit.mjs https://host [...]` checks a host for publicly exposed files
(`.env`, logs, dependency manifests, `.git/`), missing security headers, and the http→https
redirect. Read-only, about 30 seconds. Written after `api.eyesonscore.com` was found serving
its 4.1 GB Laravel log; run it after any deploy or hosting change on the EOS hosts.
