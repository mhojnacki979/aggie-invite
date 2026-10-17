import type { EventConfig } from '@/lib/types'

/** 1 -> 1st, 2 -> 2nd, 11 -> 11th, 23 -> 23rd. */
export function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }
  const suffix = suffixes[n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** `1 archer`, `2 archers`. */
export function archerCount(n: number): string {
  return n === 1 ? '1 archer' : `${n} archers`
}

/**
 * Where a division's full board lives. A finished event names its year, and one of a year's
 * several tournaments (2022) names itself; `shooterId` highlights one archer on the board.
 */
export function divisionHref(config: EventConfig, divisionSlug: string, shooterId?: string): string {
  const params = [`d=${divisionSlug}`]
  if (!config.live) params.push(`y=${config.year}`)
  if (config.sectionLabel !== null) params.push(`t=${config.slug}`)
  if (shooterId !== undefined) params.push(`a=${encodeURIComponent(shooterId)}`)
  return `/division/?${params.join('&')}`
}
