import { CURRENT_EVENT, archiveConfigs } from '../config/event'
import type { EventConfig } from './types'

/**
 * The event a division link points at. No year, or the current event's own year, means
 * CURRENT_EVENT; any other year is an archive year, and a year with several tournaments (2022)
 * names the one it wants with `tournament`. Null when nothing matches.
 */
export function resolveEventConfig(year: string | null, tournament: string | null): EventConfig | null {
  if (year === null || year === '') return CURRENT_EVENT
  const parsed = Number(year)
  if (parsed === CURRENT_EVENT.year) return CURRENT_EVENT
  const configs = archiveConfigs(parsed)
  if (!tournament) return configs[0] ?? null
  return configs.find((config) => config.slug === tournament) ?? null
}

/** Where `← All divisions` goes back to: the home page, or that archive year's results. */
export function eventHomeHref(config: EventConfig): string {
  return config === CURRENT_EVENT ? '/' : `/past/${config.year}/`
}
