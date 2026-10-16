# Aggie Invitational live scores: design

Date: 2026-10-16. Owner: Michael Hojnacki. Site: https://aggieinvite.eyesonscore.com

## Why

The Aggie Invitational (Texas A&M Archery) runs Nov 6–8, 2026 at PEAP in College
Station. About 510 archers shoot one 60-arrow 18m round across five lines:
Fri 6pm, Sat 8am, Sat 1pm, Sat 6pm and Sun 9am. Top 3 in each division get awards
Sunday after the 9am line.

The EOS public scoreboard is cluttered. A five-line event also has a specific
problem: a division leader on Friday night can be passed on Sunday morning, and
nothing on the EOS board says so. We want a clean page, like the Texas Ringer and
HLSR sites, that shows live scores and makes clear what is final and what can
still change.

## Decided by Michael

- **Direction:** option 2 "Line by line" is the home page. Option 1's leaderboard
  is the full board behind each division. Option 3's awards mode only if time
  allows. Mockups: `design/2026-10-16-options.html`.
- **Data:** old EOS (`api.eyesonscore.com`), using the same calls the Texas Ringer
  live board uses. Read only. Nothing is written to EOS.
- **Address and hosting:** aggieinvite.eyesonscore.com on GitHub Pages, repo
  `mhojnacki979/aggie-invite`. Done on 2026-10-16: placeholder page live, CNAME
  record added in HostGator, custom domain attached, certificate approved,
  HTTPS enforced.
- **QR codes:** done. `qr/aggieinvite-qr-{black,maroon}.{png,svg}`, error
  correction H, decoded and verified.
- **For now, show 2025:** the 2026 tournament is not in EOS yet. Point the site
  at the 2025 Aggie Invitational (`QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09`) until it is.
- **Scoring is on tablets, entered live each end.** "Shooting now, end X of 20" is
  meaningful, and a line can be treated as final once a later line starts.
- **2026 is one EOS tournament with the five lines as sessions, same as 2025.**
  Switching from 2025 to 2026 means changing the tournament ID and schedule in
  config. EOS rank stays the source of truth.
- **The Saturday 1pm line is the JOAD line.** Label it "JOAD line" in the strip
  and wherever an archer's line is shown. JOAD archers compete in the regular
  divisions, and nothing else changes. In 2025 that line had 82 youth archers and
  19 Senior and Masters archers, all in normal divisions.

## Goals

1. **Home (line by line).**
   - A strip with the five lines. Each one shows its day and time, its archer
     count, and its status: upcoming, shooting now (with "end X of 20"), or final.
   - Below the strip, one podium card per division with the top 3 so far. Each
     card carries one status badge: provisional, final, or tie for a podium spot.
     It also shows how many archers in that division still have to shoot.
   - Find-an-archer search. The result shows division, line, target, current
     place, total, and whether their division is still provisional.
2. **Division board.** Tap a podium card to get the full leaderboard: rank,
   archer, line and target, 1st 30, 2nd 30, total, 10s, 9s. Tap an archer to see
   their end-by-end scorecard.
3. **Live updates.** Refresh every 20 seconds while live. Show "updated Xs ago" and
   a quiet "reconnecting" note on failure. Keep the last good data on screen.
4. **After the event.** Freeze to a static JSON snapshot so the site makes no live
   calls, and keep it up as the final results. The snapshot includes every
   archer's scorecard, about 510 one-time calls, so tapping an archer on a frozen
   year still works if old EOS moves off Linode. (My call.)
5. **Past results.** Load 2025 first, since it's the demo data: `QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09`.
   After everything above works, add 2024 (`a0FvWDBhcW1kVnF3bFRRY1lMTWE0dz09`) and
   2023 (`bVRpazQxQ2NEbGRrQmpqUnR2RzZPUT09`). Leave 2022 out. That year was split
   into two EOS tournaments ("Double FITA" and "JOAD") with a different format.
   (My call.)
6. **Stretch: awards mode.** One podium per division, stepped through with a
   clicker or the space bar, for projecting during Sunday's ceremony.

## Non-goals

- Brackets or match play. This event has none.
- Registration, payments, logins, or any write to EOS.
- The option 3 TV board that scrolls itself.
- "My archers" favorites. Search covers it for v1.
- Prize money.

## Anti-goals (would make it a failure even if it works)

- **Showing a provisional leader as the winner.** Every podium must say
  provisional until the division is actually done.
- **Overloading EOS.** The Ringer live board makes one bracket call per division
  on every poll. With about 50 divisions and hundreds of phones, that's too many
  requests. This site makes **one `tournament_score_list` call per poll per visitor**,
  and none while the tab is hidden. It fetches a scorecard only when someone taps
  an archer.
- **Breaking on phones or gym Wi-Fi.** Phone first. The page works at 375px wide,
  with no horizontal page scroll.
- **Using a Texas A&M logo without the club's OK.** Use a text wordmark until the
  club approves one.
- **Labeling 2025 data as 2026.** While the site points at 2025, it says 2025
  everywhere and shows a "2026 live scoring starts Nov 6" note.

## What the data looks like (checked against 2025 on 2026-10-16)

`POST tournament_score_list?is_private=false&id=<id>&for_fav=true` returns
`data.sortingResult`, an object keyed by division name. Each group mixes archer
rows with metadata keys (for example `max_round_count`). Keep only objects that
have a `name`.

Archer row fields used:

| Field | Example | Use |
|---|---|---|
| `shooter_id` | opaque string | scorecard lookup |
| `name` | `Nicholas D'Amour` | display, search |
| `rank` | `1` | EOS rank; ties share a rank (2025 Compound U18 Male: 1, 1, 3) |
| `round_1`, `round_2` | `292`, `295` | 1st 30, 2nd 30 |
| `total_score` | `587` | total |
| `tens_count`, `nine_count` | `47`, `13` | tiebreaks |
| `target` | `23B` | bale and position |
| `session` | `College Station, 11-08-2025 01:00 PM ` | the archer's line (note the trailing space) |
| `total_attended_arrows_count` / `total_arrow_count` | `60` / `60` | arrows shot / arrows due |
| `avg_count` | `9.78` | arrow average |

2025 had 512 archers in 49 divisions and 5 sessions of about 100 archers each.

Mid-event and pre-event behavior, checked 2026-10-16:

- **Partly scored event** (Midwest Open 2025 Day 2, `TUR1ZkVCeDhNM2lkQ1FoRGxycVFQdz09`):
  archers who hadn't shot were still listed. Their `total_arrow_count` was the full
  amount due (90) and `total_attended_arrows_count` was 0. Their ranks were spread
  out, not shared. So "still to shoot" can be computed from this one call.
- **Event not started** (Aggie Prep, Oct 18 2026, `aXJtUkFNR1RPWlRDSEtnZmdWME1TZz09`):
  `sortingResult` was empty, with no groups and no archers. Do not rely on EOS
  before the first arrow. The line strip comes from a fixed schedule in config,
  and archer counts fill in as data arrives.
- **Ties are not broken in EOS:** the 2025 Compound U18 Male tie for 1st still
  reads rank 1, 1 in the finished data.

Division names are `<bow> <age> <gender>`. In 2025 the bow styles were `Recurve`,
`Compound`, `Fixed Pins`, `BAREBOW (recurve)`, `Para Compound`, `Para Recurve`
and `Para W1`. Ages were `U13`, `U15`, `U18`, `U21`, `Senior`, `50+`, `60+` and
`70+`, and genders were `Male` and `Female`. 2024 used different labels:
`Fixed Pin`, `U15 Cub`, `U18 Cadet`, `Amateur` and `50-70+`. Display names come
from parsing, and anything that doesn't parse falls back to the raw name.

Scorecard: `POST shooter_details_by_score` (form body `shooter_id`,
`tournament_id`), parsed exactly as `fetchShooterEnds` in the Texas Ringer repo
(`~/Documents/eyesonscore-series-rankings/src/lib/eos.ts`).

The read token is EOS's public scoreboard token. It already ships in the Texas
Ringer client code, so embedding it is expected.

Session times are local College Station wall-clock times. Parse the string and
display it as written. Never pass it through a time-zone conversion.

## Rules for status (my call; change if wrong)

- **Schedule:** the event config lists the five lines with a label (an optional
  tag such as "JOAD line") and the
  date-time key EOS uses in `session` (for example `11-08-2025 01:00 PM`). Match
  an archer to a line on that key, which is the text after the last comma,
  trimmed. Any session that doesn't match goes under an "Other" line.
- **Archer done:** `total_attended_arrows_count >= total_arrow_count` and
  `total_arrow_count > 0`.
- **Line status**, checked in this order:
  1. *Final* if:
     - any later line has at least one arrow; or
     - the line is listed in config `closedLines`, a manual backstop; or
     - at least one archer has shot, and every archer with an arrow is done.
       Archers with 0 arrows count as no-shows. This is how Sunday 9am closes,
       since no line follows it.
  2. *Upcoming* if none of its archers has an arrow, or EOS has no data yet.
  3. *Shooting now* otherwise, showing *end X of 20*: the most arrows any archer
     on the line has shot, divided by 3, rounded down.
- **Division final:** every archer in it is done or is on a final line. Otherwise
  the division is provisional, and the card says "N of M still to shoot".
- **Tie flag:** two or more archers with at least one arrow share an EOS rank of
  3 or better. The card says "Tie for Nth: shoot-off needed". Ties below 3rd are
  not flagged. A tie does not stop a division from reading final.
- **Shoot-off results:** EOS doesn't record them. Config `shootOffs` maps a
  division name to the tied archers in their final order. Applying it clears the
  tie flag and sets podium order on the card, the board and the frozen results.
- **Podium order:** EOS `rank`, then the order EOS returned, then `shootOffs`. Do
  not re-rank ourselves otherwise. EOS is the official result.

## Look

- Maroon `#500000` and white, light theme by default, matching the option 2
  mockup. A dark theme is selected by `prefers-color-scheme` and uses the option 1
  palette. (Your coding rule says dark mode first. Both themes ship, and the light
  one leads because that's the mockup you picked.)
- Fonts: Roboto Slab for headings, Work Sans for body text, and tabular numbers
  for scores. Medal colors for the top 3: gold `#d9a521`, silver `#bfc3cc`,
  bronze `#c27a3a`.
- Text wordmark "Aggie Invitational". The footer says "Scores by Eyes on Score".

## Constraints

- Next.js 15 static export (`output: 'export'`) on GitHub Pages, same as Texas
  Ringer. All live data is fetched in the browser. The EOS API allows cross-origin
  requests.
- Pages project URL fallback: `basePath` is `''` because the site serves at the
  custom domain root.
- Dates: live and tested by **Sun Nov 1**. Dry run Nov 2–5. Event Nov 6–8.
  Freeze Nov 9.
- Switching the site from 2025 to 2026 must be a one-line config change, then a
  push.
- Pushes to `main` have sometimes not triggered the Pages workflow in sibling
  repos. If that happens, run `gh workflow run "Deploy to GitHub Pages" --ref main`.

## Left to the builder

- File layout, component split and naming. Keep functions under 50 lines, use no
  `any` in new code, and validate the EOS responses at the boundary.
- How the division board is addressed in a static export. Division names aren't
  known at build time for 2026, so use a query string such as
  `/division/?d=<slug>` rather than generated routes.
- How to show the live states before Nov 6. The 2025 data is complete, so every
  line reads final. A test fixture that cuts the 2025 snapshot off at a chosen
  line and end is expected. A hidden preview switch on the site, so Michael can
  see "shooting now", is the builder's call.
- Sort order of podium cards: bow style, then age youngest to oldest, then women
  before men.
- Copy and empty states.

## Open, needs Michael or the club

1. Has the Texas A&M Archery club approved this page, and is there a club logo to
   use? (Not blocking. The text wordmark ships until then.)
2. 2026 EOS tournament ID, once Michael creates it. Until then the site shows 2025.
3. If awards mode is built: the club's awards order, and a screen or projector in
   the gym.

## Calls made without asking (check these)

- Light theme by default, with a dark theme for dark-mode phones.
- Roboto Slab and Work Sans fonts.
- The status rules above, including treating archers with 0 arrows as no-shows
  once everyone else on their line is done.
- Hand-entered shoot-off results through config, since EOS doesn't record them.
- Saving every scorecard in the frozen results.
- Past results cover 2023–2025, not 2022.
- No "my archers" favorites in v1.
