import type { EventConfig, LineConfig } from '../lib/types'

function weekendLines(fri: string, sat: string, sun: string): LineConfig[] {
  return [
    { key: `${fri} 06:00 PM`, label: 'Fri 6:00 PM' },
    { key: `${sat} 08:00 AM`, label: 'Sat 8:00 AM' },
    { key: `${sat} 01:00 PM`, label: 'Sat 1:00 PM', tag: 'JOAD line' },
    { key: `${sat} 06:00 PM`, label: 'Sat 6:00 PM' },
    { key: `${sun} 09:00 AM`, label: 'Sun 9:00 AM' },
  ]
}

export const EVENT_2025: EventConfig = {
  year: 2025,
  slug: '2025',
  sectionLabel: null,
  name: '2025 Aggie Invitational',
  dates: 'Nov 7–9, 2025',
  tournamentId: 'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09',
  // Finished: served from public/data/2025.json, so the site makes no EOS request.
  live: false,
  lines: weekendLines('11-07-2025', '11-08-2025', '11-09-2025'),
  closedLines: [],
  openLines: [],
  shootOffs: {},
}

export const EVENT_2026: EventConfig = {
  year: 2026,
  slug: '2026',
  sectionLabel: null,
  name: '2026 Aggie Invitational',
  dates: 'Nov 6–8, 2026',
  // Michael fills this in once EOS has the 2026 tournament.
  tournamentId: '',
  live: true,
  lines: weekendLines('11-06-2026', '11-07-2026', '11-08-2026'),
  closedLines: [],
  openLines: [],
  shootOffs: {},
}

// Switch this to EVENT_2026 once EVENT_2026.tournamentId is set.
export const CURRENT_EVENT: EventConfig = EVENT_2025

export interface ArchiveTournament {
  slug: string
  id: string
  name: string
  sectionLabel: string | null
}

export interface ArchiveYear {
  year: number
  label: string
  dates: string
  tournaments: ArchiveTournament[]
}

/** Every year EOS holds, newest first. */
export const YEARS: ArchiveYear[] = [
  {
    year: 2025,
    label: '2025',
    dates: 'Nov 7–9, 2025',
    tournaments: [
      { slug: '2025', id: 'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09', name: '2025 Aggie Invitational', sectionLabel: null },
    ],
  },
  {
    year: 2024,
    label: '2024',
    dates: 'Nov 22–24, 2024',
    tournaments: [
      { slug: '2024', id: 'a0FvWDBhcW1kVnF3bFRRY1lMTWE0dz09', name: '2024 Aggie Invitational', sectionLabel: null },
    ],
  },
  {
    year: 2023,
    label: '2023',
    dates: 'Nov 3–5, 2023',
    tournaments: [
      { slug: '2023', id: 'bVRpazQxQ2NEbGRrQmpqUnR2RzZPUT09', name: '2023 Aggie Invitational', sectionLabel: null },
    ],
  },
  {
    year: 2022,
    label: '2022',
    dates: 'Nov 11–13, 2022',
    tournaments: [
      {
        slug: '2022-double-fita',
        id: 'bWkrMXQ2bEhIaHdaVjBveUZQNVYyZz09',
        name: 'Aggie Invitational - Double FITA',
        sectionLabel: 'Double FITA · 120 arrows',
      },
      {
        slug: '2022-joad',
        id: 'dFZISWJuT051SkNmb2lkNVB3cVdFQT09',
        name: 'Aggie Invite - JOAD',
        sectionLabel: 'JOAD · 60 arrows',
      },
    ],
  },
]

/**
 * One config per tournament held that year. Archive years derive their lines
 * from the data (2024 and 2023 each had six), so the configs carry none.
 */
export function archiveConfigs(year: number): EventConfig[] {
  const entry = YEARS.find((item) => item.year === year)
  if (!entry) return []
  return entry.tournaments.map((t) => ({
    year,
    slug: t.slug,
    sectionLabel: t.sectionLabel,
    name: t.name,
    dates: entry.dates,
    tournamentId: t.id,
    live: false,
    lines: [],
    closedLines: [],
    finished: true,
    shootOffs: {},
  }))
}

/** Also what the page says while a live event has no EOS tournament id yet. */
export const SCORING_SOON_NOTE = '2026 live scoring starts Fri, Nov 6 at 6:00 PM'

export const NEXT_EVENT_NOTE: string | null = CURRENT_EVENT.year < 2026 ? SCORING_SOON_NOTE : null
