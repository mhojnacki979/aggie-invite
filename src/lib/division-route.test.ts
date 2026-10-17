import { describe, expect, it } from 'vitest'
import { CURRENT_EVENT } from '../config/event'
import { eventHomeHref, resolveEventConfig } from './division-route'

describe('resolveEventConfig', () => {
  it('uses the current event with no year, or its own year', () => {
    expect(resolveEventConfig(null, null)).toBe(CURRENT_EVENT)
    expect(resolveEventConfig('', null)).toBe(CURRENT_EVENT)
    expect(resolveEventConfig(String(CURRENT_EVENT.year), null)).toBe(CURRENT_EVENT)
  })

  it('uses the archive year otherwise', () => {
    expect(resolveEventConfig('2024', null)?.slug).toBe('2024')
    expect(resolveEventConfig('2023', null)?.live).toBe(false)
  })

  it('picks the tournament inside a multi-tournament year', () => {
    expect(resolveEventConfig('2022', 't')).toBeNull()
    expect(resolveEventConfig('2022', '2022-joad')?.tournamentId).toBe('dFZISWJuT051SkNmb2lkNVB3cVdFQT09')
    expect(resolveEventConfig('2022', null)?.slug).toBe('2022-double-fita')
  })

  it('is null for a year nothing was held', () => {
    expect(resolveEventConfig('1999', null)).toBeNull()
    expect(resolveEventConfig('abc', null)).toBeNull()
  })
})

describe('eventHomeHref', () => {
  it('goes home for the current event and to the year page for an archive year', () => {
    expect(eventHomeHref(CURRENT_EVENT)).toBe('/')
    expect(eventHomeHref(resolveEventConfig('2024', null) ?? CURRENT_EVENT)).toBe('/past/2024/')
  })
})
