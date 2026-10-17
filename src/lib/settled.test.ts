import { describe, expect, it } from 'vitest'
import { badgesFor, footerLines } from './settled'

describe('badgesFor', () => {
  it('a final division with a tie wears only the tie badge', () => {
    expect(badgesFor({ status: 'final', tieFor: 1 })).toEqual(['tie'])
  })

  it('a provisional division with a tie wears the tie badge and Provisional, never settled', () => {
    expect(badgesFor({ status: 'provisional', tieFor: 2 })).toEqual(['tie', 'provisional'])
  })

  it('a final division with no tie reads Final', () => {
    expect(badgesFor({ status: 'final', tieFor: null })).toEqual(['final'])
  })

  it('a provisional division with no tie reads Provisional', () => {
    expect(badgesFor({ status: 'provisional', tieFor: null })).toEqual(['provisional'])
  })
})

describe('footerLines', () => {
  it('says "All N have shot" only when every archer has shot', () => {
    expect(footerLines({ remaining: 0, count: 10, shot: 10, tieFor: null })).toEqual(['All 10 have shot'])
  })

  it('does not claim everyone shot when archers have no score', () => {
    const [line] = footerLines({ remaining: 0, count: 26, shot: 22, tieFor: null })
    expect(line).toBe('22 of 26 have shot, 4 with no score')
    expect(line).not.toMatch(/^All/)
  })

  it('counts what is still to shoot while the division is open', () => {
    expect(footerLines({ remaining: 4, count: 10, shot: 6, tieFor: null })).toEqual(['4 of 10 still to shoot'])
  })

  it('adds the shoot-off note under a tie', () => {
    expect(footerLines({ remaining: 0, count: 5, shot: 5, tieFor: 1 })).toEqual([
      'All 5 have shot',
      'Same score, 10s and 9s: shoot-off needed',
    ])
  })
})
