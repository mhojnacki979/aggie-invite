import { describe, expect, it } from 'vitest'
import { listedDivisions } from './division-options'
import type { DivisionView } from './status'

function division(slug: string, shot: number): DivisionView {
  return { name: slug, display: { slug, label: slug } as DivisionView['display'], shot } as DivisionView
}

const divisions = [division('recurve-senior-men', 4), division('compound-u18-women', 0), division('barebow-senior-men', 2)]

describe('listedDivisions', () => {
  it('lists every division at a live event, unscored ones included, in board order', () => {
    expect(listedDivisions(divisions, true).map((item) => item.display.slug)).toEqual([
      'recurve-senior-men',
      'compound-u18-women',
      'barebow-senior-men',
    ])
  })

  it('lists only scored divisions for a finished event, so a no-show division never appears', () => {
    expect(listedDivisions(divisions, false).map((item) => item.display.slug)).toEqual(['recurve-senior-men', 'barebow-senior-men'])
  })
})
