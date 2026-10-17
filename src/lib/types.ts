/** One archer's line in a division, as shown on the live leaderboard. */
export interface ArcherRow {
  shooterId: string
  name: string
  division: string
  rank: number
  half1: number
  half2: number
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
