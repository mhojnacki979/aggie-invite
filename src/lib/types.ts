/** One archer's line in a division, as shown on the live leaderboard. */
export interface ArcherRow {
  shooterId: string
  name: string
  division: string
  rank: number
  /** Every round's score, in round order. Length follows the event (2 for 60 arrows, 4 for a Double FITA). */
  rounds: number[]
  total: number
  tens: number
  nines: number
  target: string
  /** Raw EOS session label, trailing space and all. */
  session: string
  arrowsShot: number
  arrowsDue: number
  avg: string
}

export interface EndScore {
  arrows: string[]
  /** Points scored this end. */
  score: number
  /** Cumulative total through this end, across all rounds. */
  running: number
}

export interface Scorecard {
  name: string
  total: number
  avg: string
  target: string
  ends: EndScore[]
}

/** One shooting line (a session), keyed by the date and time EOS stamps on archers. */
export interface LineConfig {
  key: string
  label: string
  tag?: string
}

export interface EventConfig {
  year: number
  /** URL segment for this tournament within its year. */
  slug: string
  /** Heading used when a year holds more than one tournament; null for a single event. */
  sectionLabel: string | null
  name: string
  dates: string
  tournamentId: string
  live: boolean
  lines: LineConfig[]
  closedLines: string[]
  /**
   * The tournament is over and its results are saved: every line with an arrow is final even when an
   * archer withdrew partway (2022). Unset on the current event so its `?preview=` states still show.
   */
  finished?: boolean
  shootOffs: Record<string, string[]>
}
