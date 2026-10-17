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
  name: '2025 Aggie Invitational',
  dates: 'Nov 7–9, 2025',
  tournamentId: 'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09',
  live: true,
  lines: weekendLines('11-07-2025', '11-08-2025', '11-09-2025'),
  closedLines: [],
  shootOffs: {},
}

export const EVENT_2026: EventConfig = {
  year: 2026,
  name: '2026 Aggie Invitational',
  dates: 'Nov 6–8, 2026',
  // Michael fills this in once EOS has the 2026 tournament.
  tournamentId: '',
  live: true,
  lines: weekendLines('11-06-2026', '11-07-2026', '11-08-2026'),
  closedLines: [],
  shootOffs: {},
}

// Switch this to EVENT_2026 once EVENT_2026.tournamentId is set.
export const CURRENT_EVENT: EventConfig = EVENT_2025

export const ARCHIVE: { year: number; tournamentId: string; name: string; dates: string }[] = [
  {
    year: 2025,
    tournamentId: 'QVRrY0JnUWtSTXJRdVBmN0xzWnBHQT09',
    name: '2025 Aggie Invitational',
    dates: 'Nov 7–9, 2025',
  },
  {
    year: 2024,
    tournamentId: 'a0FvWDBhcW1kVnF3bFRRY1lMTWE0dz09',
    name: '2024 Aggie Invitational',
    dates: 'Nov 22–24, 2024',
  },
  {
    year: 2023,
    tournamentId: 'bVRpazQxQ2NEbGRrQmpqUnR2RzZPUT09',
    name: '2023 Aggie Invitational',
    dates: 'Nov 3–5, 2023',
  },
]

/**
 * Archive years derive their lines from the data (2024 and 2023 each had six),
 * so the config carries none.
 */
export function archiveConfig(year: number): EventConfig | null {
  const entry = ARCHIVE.find((item) => item.year === year)
  if (!entry) return null
  return { ...entry, live: false, lines: [], closedLines: [], shootOffs: {} }
}

export const NEXT_EVENT_NOTE: string | null =
  CURRENT_EVENT.year < 2026 ? '2026 live scoring starts Fri, Nov 6 at 6:00 PM' : null
