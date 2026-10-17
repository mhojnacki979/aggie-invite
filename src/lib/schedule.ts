import type { ArcherRow, LineConfig } from './types'

export const OTHER_LINE_KEY = 'other'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const KEY_PATTERN = /^(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/

interface ParsedKey {
  year: number
  month: number
  day: number
  hour12: number
  minute: string
  meridiem: string
  /** Sortable instant; the wall clock read as UTC, never shifted by a time zone. */
  sortValue: number
}

function parseKey(key: string): ParsedKey | null {
  const match = KEY_PATTERN.exec(key)
  if (!match) return null
  const [, mm, dd, yyyy, hh, minute, meridiem] = match
  if (!mm || !dd || !yyyy || !hh || !minute || !meridiem) return null
  const month = Number(mm)
  const day = Number(dd)
  const year = Number(yyyy)
  const hour12 = Number(hh)
  const hour24 = (hour12 % 12) + (meridiem === 'PM' ? 12 : 0)
  const sortValue = Date.UTC(year, month - 1, day, hour24, Number(minute))
  return { year, month, day, hour12, minute, meridiem, sortValue }
}

/** EOS writes `<venue>, MM-DD-YYYY hh:mm AM `; the line is the text after the last comma. */
export function sessionKey(session: string): string {
  return session.slice(session.lastIndexOf(',') + 1).trim()
}

export function lineKeyFor(row: ArcherRow, lines: LineConfig[]): string {
  const key = sessionKey(row.session)
  return lines.some((line) => line.key === key) ? key : OTHER_LINE_KEY
}

function labelFor(key: string): string {
  const parsed = parseKey(key)
  if (!parsed) return key
  const weekday = WEEKDAYS[new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()]
  return `${weekday} ${parsed.hour12}:${parsed.minute} ${parsed.meridiem}`
}

/** Distinct sessions in the data, in date and time order, labelled like "Sat 8:00 AM". */
export function deriveLines(rows: ArcherRow[]): LineConfig[] {
  const keys = [...new Set(rows.map((row) => sessionKey(row.session)))]
  const sortValue = (key: string): number => parseKey(key)?.sortValue ?? Number.POSITIVE_INFINITY
  return keys
    .sort((a, b) => sortValue(a) - sortValue(b) || a.localeCompare(b))
    .map((key) => ({ key, label: labelFor(key) }))
}

/** First and last shooting day, e.g. "Nov 7–9, 2025". */
export function eventDates(rows: ArcherRow[]): string {
  const days = rows
    .map((row) => parseKey(sessionKey(row.session)))
    .filter((parsed): parsed is ParsedKey => parsed !== null)
    .map((parsed) => Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  if (days.length === 0) return ''
  const first = new Date(Math.min(...days))
  const last = new Date(Math.max(...days))
  const start = `${MONTHS[first.getUTCMonth()]} ${first.getUTCDate()}`
  const year = last.getUTCFullYear()
  if (first.getTime() === last.getTime()) return `${start}, ${year}`
  const sameMonth = first.getUTCMonth() === last.getUTCMonth()
  const end = sameMonth ? `${last.getUTCDate()}` : `${MONTHS[last.getUTCMonth()]} ${last.getUTCDate()}`
  return `${start}–${end}, ${year}`
}
