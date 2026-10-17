import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVENT_2025 } from '../config/event'
import { parseScoreList } from './eos-schema'
import { cutAt, parsePreview } from './preview'
import { sessionKey } from './schedule'
import { buildEventView, isDone } from './status'
import type { DivisionView, EventView } from './status'
import type { ArcherRow, EventConfig } from './types'

const SUNDAY = '11-09-2025 09:00 AM'
const OTHER_SESSION = 'College Station, 11-08-2025 1:00 PM'

function loadRows(): ArcherRow[] {
  const text = readFileSync(
    new URL('../test/fixtures/aggie-2025-score-list.json', import.meta.url),
    'utf8',
  )
  const parsed: { data: unknown } = JSON.parse(text)
  return parseScoreList(parsed.data).rows
}

const rows = loadRows()
const cfg = EVENT_2025

function division(view: EventView, name: string): DivisionView {
  const found = view.divisions.find((d) => d.name === name)
  if (!found) throw new Error(`no division ${name}`)
  return found
}

function names(rowList: ArcherRow[]): string[] {
  return rowList.map((r) => r.name)
}

function rowNamed(name: string): ArcherRow {
  const found = rows.find((r) => r.name === name)
  if (!found) throw new Error(`no archer ${name}`)
  return found
}

function replaceRow(list: ArcherRow[], target: ArcherRow, patch: Partial<ArcherRow>): ArcherRow[] {
  return list.map((r) => (r === target ? { ...r, ...patch } : r))
}

function statuses(view: EventView): string[] {
  return view.lines.map((l) => l.status)
}

function sundayPartial(): { list: ArcherRow[]; division: string } {
  const annabelle = rowNamed('Annabelle Moore')
  return { list: replaceRow(rows, annabelle, { arrowsShot: 30 }), division: annabelle.division }
}

function firstRow(predicate: (r: ArcherRow) => boolean): ArcherRow {
  const found = rows.find(predicate)
  if (!found) throw new Error('fixture row missing')
  return found
}

describe('isDone', () => {
  it('needs arrows due and every one shot', () => {
    const base = rowNamed('Annabelle Moore')
    expect(isDone({ ...base, arrowsShot: 60, arrowsDue: 60 })).toBe(true)
    expect(isDone({ ...base, arrowsShot: 59, arrowsDue: 60 })).toBe(false)
    expect(isDone({ ...base, arrowsShot: 0, arrowsDue: 0 })).toBe(false)
  })
})

describe('buildEventView on the full 2025 data', () => {
  const view = buildEventView(rows, cfg)

  it('1. every line and division is final', () => {
    expect(statuses(view)).toEqual(['final', 'final', 'final', 'final', 'final'])
    expect(view.lines.map((l) => l.archers)).toEqual([100, 105, 101, 102, 104])
    expect(view.divisions).toHaveLength(49)
    expect(view.divisions.every((d) => d.status === 'final')).toBe(true)
    const sunday = rows.filter((r) => r.session.includes(SUNDAY))
    expect(sunday.filter((r) => r.arrowsShot === 0)).toHaveLength(9)
  })

  it('2. Compound U18 Male has a tie for 1st', () => {
    const d = division(view, 'Compound U18 Male')
    expect(d.tieFor).toBe(1)
    expect(names(d.podium)).toEqual(['Brody Wonch', 'Caleb Quiocho', 'Chase Crotty'])
  })

  it('3. Compound Senior Male has a tie for 2nd', () => {
    expect(division(view, 'Compound Senior Male').tieFor).toBe(2)
  })

  it('4. a rank-3 archer with no arrows is left off the podium', () => {
    expect(division(view, 'Recurve 50+ Male').podium).toHaveLength(2)
  })

  it('5. a division of one no-show is final with no podium', () => {
    const d = division(view, 'Para Compound Senior Male')
    expect(d.shot).toBe(0)
    expect(d.status).toBe('final')
    expect(d.podium).toEqual([])
  })

  it('13. Compound Senior Female stays final despite the 33-arrow archer', () => {
    const d = division(view, 'Compound Senior Female')
    expect(rows.some((r) => r.division === d.name && r.arrowsShot === 33)).toBe(true)
    expect(d.status).toBe('final')
  })

  it('keeps EOS ranks and total_score untouched', () => {
    const d = division(view, 'Compound U18 Male')
    const source = rows.filter((r) => r.division === d.name)
    expect(d.rows).toHaveLength(source.length)
    for (const row of d.rows) {
      const original = source.find((r) => r.shooterId === row.shooterId)
      expect(row.total).toBe(original?.total)
      expect(row.rank).toBe(original?.rank)
    }
  })

  it('maps every shooter to their line', () => {
    const brody = rowNamed('Brody Wonch')
    expect(view.lineByShooter[brody.shooterId]?.key).toBe(sessionKey(brody.session))
    for (const row of rows) {
      expect(view.lineByShooter[row.shooterId]?.key).toBe(sessionKey(row.session))
    }
  })
})

describe('shoot-offs', () => {
  function withShootOffs(shootOffs: EventConfig['shootOffs']): EventView {
    return buildEventView(rows, { ...cfg, shootOffs })
  }

  it('6. applies a complete shoot-off result', () => {
    const view = withShootOffs({ 'Compound U18 Male': ['Caleb Quiocho', 'Brody Wonch'] })
    const d = division(view, 'Compound U18 Male')
    expect(d.tieFor).toBeNull()
    expect(names(d.podium)).toEqual(['Caleb Quiocho', 'Brody Wonch', 'Chase Crotty'])
    expect(d.podium.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('7. leaves the rows alone when a name is misspelled', () => {
    const view = withShootOffs({ 'Compound U18 Male': ['Caleb Quicho', 'Brody Wonch'] })
    const d = division(view, 'Compound U18 Male')
    expect(d.tieFor).toBe(1)
    expect(names(d.podium)).toEqual(['Brody Wonch', 'Caleb Quiocho', 'Chase Crotty'])
  })

  it('leaves the rows alone when the entry names only some of the tied archers', () => {
    const third = rowNamed('Chase Crotty')
    const tiedThree = replaceRow(rows, third, { rank: 1 })
    const view = buildEventView(tiedThree, {
      ...cfg,
      shootOffs: { 'Compound U18 Male': ['Caleb Quiocho', 'Brody Wonch'] },
    })
    const d = division(view, 'Compound U18 Male')
    expect(d.tieFor).toBe(1)
    expect(names(d.podium)).toEqual(['Brody Wonch', 'Caleb Quiocho', 'Chase Crotty'])
    expect(d.podium.map((r) => r.rank)).toEqual([1, 1, 1])
  })

  it('leaves the rows alone when the named archers do not share a rank', () => {
    const view = withShootOffs({ 'Compound U18 Male': ['Caleb Quiocho', 'Chase Crotty'] })
    const d = division(view, 'Compound U18 Male')
    expect(d.tieFor).toBe(1)
    expect(d.podium.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  describe('a declined entry says why on the console', () => {
    afterEach(() => vi.restoreAllMocks())

    function warningsFor(shootOffs: EventConfig['shootOffs'], source: ArcherRow[] = rows): string[] {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      buildEventView(source, { ...cfg, shootOffs })
      return warn.mock.calls.map((call) => String(call[0]))
    }

    it('names a misspelled archer and the division', () => {
      const [message] = warningsFor({ 'Compound U18 Male': ['Caleb Quicho', 'Brody Wonch'] })
      expect(message).toContain('Compound U18 Male')
      expect(message).toContain('"Caleb Quicho"')
    })

    it('says a partial list needs every tied archer', () => {
      const tiedThree = replaceRow(rows, rowNamed('Chase Crotty'), { rank: 1 })
      const [message] = warningsFor({ 'Compound U18 Male': ['Caleb Quiocho', 'Brody Wonch'] }, tiedThree)
      expect(message).toContain('3 archers share rank 1 but 2 are listed')
    })

    it('says when the listed archers do not share a rank', () => {
      const [message] = warningsFor({ 'Compound U18 Male': ['Caleb Quiocho', 'Chase Crotty'] })
      expect(message).toContain('do not all share one rank')
    })

    it('says when an archer is listed twice', () => {
      const [message] = warningsFor({ 'Compound U18 Male': ['Caleb Quiocho', 'Caleb Quiocho'] })
      expect(message).toContain('more than once')
    })

    it('says when no division has that name', () => {
      const [message] = warningsFor({ 'Compund U18 Male': ['Caleb Quiocho', 'Brody Wonch'] })
      expect(message).toContain('Compund U18 Male')
      expect(message).toContain('no division has that name')
    })

    it('stays quiet for a complete, correct entry', () => {
      expect(warningsFor({ 'Compound U18 Male': ['Caleb Quiocho', 'Brody Wonch'] })).toEqual([])
    })
  })
})

describe('mid-event states', () => {
  it('8. cut at line 2, end 12', () => {
    const view = buildEventView(cutAt(rows, cfg.lines, 2, 12), cfg)
    expect(statuses(view)).toEqual(['final', 'final', 'shooting', 'upcoming', 'upcoming'])
    expect(view.lines[2]?.endsShot).toBe(12)
    const senior = division(view, 'Recurve Senior Male')
    expect(senior.status).toBe('provisional')
    expect(senior.remaining).toBe(15)
    expect(senior.count).toBe(30)
    const u21 = division(view, 'Recurve U21 Male')
    expect(u21.status).toBe('provisional')
    expect(u21.remaining).toBe(4)
  })

  it('9. one Sunday archer part-way keeps the Sunday line shooting and her division provisional', () => {
    const { list, division: name } = sundayPartial()
    const view = buildEventView(list, cfg)
    expect(view.lines[4]?.status).toBe('shooting')
    const d = division(view, name)
    expect(d.status).toBe('provisional')
    expect(d.remaining).toBe(1)
  })

  it('10. closedLines is a manual backstop', () => {
    const { list, division: name } = sundayPartial()
    const view = buildEventView(list, { ...cfg, closedLines: [SUNDAY] })
    expect(view.lines[4]?.status).toBe('final')
    expect(division(view, name).status).toBe('final')
  })

  it('10b. a finished event closes every line that has an arrow, whoever dropped out', () => {
    const { list, division: name } = sundayPartial()
    const view = buildEventView(list, { ...cfg, finished: true })
    expect(view.lines[4]?.status).toBe('final')
    expect(division(view, name).status).toBe('final')
  })

  it('10c. a finished event still reads upcoming for a line nobody shot', () => {
    const view = buildEventView([], { ...cfg, finished: true })
    expect(statuses(view)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
  })

  describe('openLines', () => {
    const FRIDAY = cfg.lines[0]?.key ?? ''

    // Friday is done (the 2025 data has one Friday archer who stopped partway; finish them) and
    // nobody has shot Saturday yet, so the no-show rule alone is what closes it.
    const fridayOnly = cutAt(rows, cfg.lines, 1, 0).map((r) =>
      r.arrowsShot > 0 ? { ...r, arrowsShot: r.arrowsDue } : r,
    )

    /** The Friday scores with one archer's left off, as if their card were still on paper. */
    function withUnenteredArcher(): { list: ArcherRow[]; division: string } {
      // From a division shot entirely on Friday, so no later line holds it open on its own.
      const allFriday = (name: string): boolean =>
        fridayOnly.filter((r) => r.division === name).every((r) => r.session.includes('11-07-2025'))
      const target = fridayOnly.find((r) => r.arrowsShot > 0 && allFriday(r.division))
      if (!target) throw new Error('no all-Friday division')
      const blank = { arrowsShot: 0, total: 0, tens: 0, nines: 0, rounds: target.rounds.map(() => 0) }
      return { list: replaceRow(fridayOnly, target, blank), division: target.division }
    }

    it('without it, the no-show rule closes the Friday line and reads an unentered archer as a no-show', () => {
      const { list, division: name } = withUnenteredArcher()
      const view = buildEventView(list, cfg)
      expect(statuses(view)[0]).toBe('final')
      expect(division(view, name).remaining).toBe(0)
    })

    it('a line listed there stays shooting, and a division with an unentered archer stays provisional', () => {
      const { list, division: name } = withUnenteredArcher()
      const view = buildEventView(list, { ...cfg, openLines: [FRIDAY] })
      expect(statuses(view)[0]).toBe('shooting')
      expect(division(view, name).status).toBe('provisional')
      expect(division(view, name).remaining).toBeGreaterThan(0)
    })

    it('keeps a line open even once a later line has started', () => {
      const view = buildEventView(rows, { ...cfg, openLines: [FRIDAY] })
      expect(statuses(view)).toEqual(['shooting', 'final', 'final', 'final', 'final'])
    })

    it('wins over closedLines', () => {
      const view = buildEventView(fridayOnly, { ...cfg, closedLines: [FRIDAY], openLines: [FRIDAY] })
      expect(statuses(view)[0]).toBe('shooting')
    })

    it('shows an archer whose scores are on paper as still to shoot, not as a closed no-show', () => {
      const logan = rowNamed('Logan Hamilton')
      const onPaper = replaceRow(rows, logan, { arrowsShot: 0, total: 0, tens: 0, nines: 0, rounds: logan.rounds.map(() => 0) })
      const closed = division(buildEventView(onPaper, cfg), logan.division)
      expect(closed.status).toBe('final')
      const open = division(buildEventView(onPaper, { ...cfg, openLines: [sessionKey(logan.session)] }), logan.division)
      expect(open.status).toBe('provisional')
      expect(open.remaining).toBeGreaterThan(0)
    })

    it('changes nothing when unset or empty', () => {
      expect(buildEventView(rows, cfg)).toEqual(buildEventView(rows, { ...cfg, openLines: [] }))
    })
  })

  it('11. no data at all reads upcoming', () => {
    const view = buildEventView([], cfg)
    expect(view.lines).toHaveLength(5)
    expect(statuses(view)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(view.lines.every((l) => l.archers === 0)).toBe(true)
    expect(view.divisions).toEqual([])
  })

  it('12. an unmatched session goes under Other', () => {
    const target = rowNamed('Annabelle Moore')
    const view = buildEventView(replaceRow(rows, target, { session: OTHER_SESSION }), cfg)
    expect(view.lines).toHaveLength(6)
    expect(view.lines[5]).toMatchObject({ key: 'other', label: 'Other', archers: 1 })
    expect(division(view, target.division).rows.some((r) => r.shooterId === target.shooterId)).toBe(true)
  })

  it('12b. the Other line never closes real lines', () => {
    const cut = cutAt(rows, cfg.lines, 2, 12)
    const friday = cut.find((r) => r.session.includes('11-07-2025') && r.arrowsShot === 60)
    if (!friday) throw new Error('no full Friday archer')
    const view = buildEventView(replaceRow(cut, friday, { session: OTHER_SESSION }), cfg)
    expect(statuses(view).slice(0, 5)).toEqual(['final', 'final', 'shooting', 'upcoming', 'upcoming'])
  })

  it('derives lines from the data when the config lists none', () => {
    const view = buildEventView(rows, { ...cfg, lines: [] })
    expect(view.lines).toHaveLength(5)
    expect(statuses(view)).toEqual(['final', 'final', 'final', 'final', 'final'])
  })
})

describe('cutAt', () => {
  it('leaves earlier lines untouched and zeroes later lines', () => {
    const cut = cutAt(rows, cfg.lines, 2, 12)
    const early = firstRow((r) => r.session.includes('11-07-2025') && r.arrowsShot === 60)
    const late = firstRow((r) => r.session.includes(SUNDAY) && r.arrowsShot === 60)
    // Rank is checked apart: a simulation re-ranks, and zeroing later-line rivals can move it up.
    const kept = cut.find((r) => r.shooterId === early.shooterId)
    expect({ ...kept, rank: 0 }).toEqual({ ...early, rank: 0 })
    expect(kept?.rank).toBeGreaterThanOrEqual(1)
    expect(kept?.rank).toBeLessThanOrEqual(early.rank)
    expect(cut.find((r) => r.shooterId === late.shooterId)).toMatchObject({
      arrowsShot: 0,
      total: 0,
      tens: 0,
      nines: 0,
      rounds: [0, 0],
    })
  })

  it('scales the round in progress and zeroes the unstarted one', () => {
    const target = firstRow(
      (r) => r.session.includes('11-08-2025 01:00 PM') && r.arrowsShot === 60 && (r.rounds[0] ?? 0) > 0,
    )
    const cut = cutAt([target], cfg.lines, 2, 5).at(0)
    expect(cut?.arrowsShot).toBe(15)
    expect(cut?.rounds).toEqual([Math.round((target.rounds[0] ?? 0) / 2), 0])
    expect(cut?.total).toBe(cut?.rounds[0])
  })

  it('keeps a full first round and scales the second', () => {
    const target = firstRow((r) => r.session.includes('11-08-2025 01:00 PM') && r.arrowsShot === 60)
    const cut = cutAt([target], cfg.lines, 2, 15).at(0)
    expect(cut?.arrowsShot).toBe(45)
    expect(cut?.rounds[0]).toBe(target.rounds[0])
    expect(cut?.rounds[1]).toBe(Math.round((target.rounds[1] ?? 0) * 0.5))
  })

  it('does not shrink a partial archer who is already behind the cut', () => {
    const base = rowNamed('Annabelle Moore')
    const partial: ArcherRow = {
      ...base,
      session: 'College Station, 11-07-2025 06:00 PM ',
      rounds: [250, 20],
      total: 270,
      arrowsShot: 33,
      arrowsDue: 60,
    }
    const cut = cutAt([partial], cfg.lines, 0, 20).at(0)
    expect(cut?.arrowsShot).toBe(33)
    expect(cut?.rounds).toEqual([250, 20])
    expect(cut?.total).toBe(270)
  })

  it('scales a four-round event by arrowsDue over rounds', () => {
    const base = rowNamed('Annabelle Moore')
    const quad: ArcherRow = {
      ...base,
      session: 'College Station, 11-07-2025 06:00 PM ',
      rounds: [100, 200, 300, 400],
      total: 1000,
      tens: 40,
      nines: 20,
      arrowsShot: 144,
      arrowsDue: 144,
    }
    const cut = cutAt([quad], cfg.lines, 0, 18).at(0)
    expect(cut?.arrowsShot).toBe(54)
    expect(cut?.rounds).toEqual([100, Math.round((200 * 18) / 36), 0, 0])
    expect(cut?.tens).toBe(Math.round((40 * 54) / 144))
  })

  it('re-ranks each division with competition ranking', () => {
    const cut = cutAt(rows, cfg.lines, 4, 20)
    const ranks = cut.filter((r) => r.division === 'Compound U18 Male').map((r) => r.rank)
    expect(ranks.slice().sort((a, b) => a - b).slice(0, 3)).toEqual([1, 1, 3])
  })
})

describe('parsePreview', () => {
  it('14. accepts line-end and rejects the rest', () => {
    expect(parsePreview('2-12')).toEqual({ lineIndex: 2, end: 12 })
    expect(parsePreview('2-21')).toBeNull()
    expect(parsePreview('x')).toBeNull()
    expect(parsePreview(null)).toBeNull()
    expect(parsePreview('2-12 ')).toBeNull()
    expect(parsePreview('0-0')).toEqual({ lineIndex: 0, end: 0 })
  })
})
