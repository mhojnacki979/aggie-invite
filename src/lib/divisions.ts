export interface DivisionName {
  bow: string
  age: string
  gender: 'Women' | 'Men' | null
  label: string
  slug: string
  known: boolean
  sortKey: [number, number, number]
}

interface BowEntry {
  display: string
  index: number
  matches: string[]
}

const BOWS: BowEntry[] = [
  { display: 'Recurve', index: 0, matches: ['Recurve'] },
  { display: 'Compound', index: 1, matches: ['Compound'] },
  { display: 'Barebow', index: 2, matches: ['BAREBOW (recurve)', 'Barebow (recurve)', 'Barebow'] },
  { display: 'Fixed Pins', index: 3, matches: ['Fixed Pins', 'Fixed Pin'] },
  ...['Para Recurve', 'Para Compound', 'Para Compound VI', 'Para W1', 'Para V.I.'].map((name) => ({
    display: name,
    index: 4,
    matches: [name],
  })),
]

const AGE_ORDER = ['U13', 'U15', 'U18', 'U21', 'Senior', 'Amateur', '50+', '50–70+', '60+', '70+']
const UNKNOWN_AGE_INDEX = 98
const UNKNOWN_SORT_KEY: [number, number, number] = [9, 99, 9]

/** Class words that sit beside the age and add nothing to the label. */
const CLASS_WORDS = new Set(['cub', 'bowman', 'cadet', 'junior', 'trophy'])

const GENDERS: Record<string, 'Women' | 'Men'> = { female: 'Women', male: 'Men' }
const GENDER_ORDER = { Women: 0, Men: 1 }

function findBow(raw: string): { entry: BowEntry; length: number } | null {
  const lower = raw.toLowerCase()
  let best: { entry: BowEntry; length: number } | null = null
  for (const entry of BOWS) {
    for (const match of entry.matches) {
      const m = match.toLowerCase()
      const atBoundary = lower.length === m.length || lower[m.length] === ' '
      if (lower.startsWith(m) && atBoundary && (!best || m.length > best.length)) {
        best = { entry, length: m.length }
      }
    }
  }
  return best
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** An age not in AGE_ORDER (the 2022 JOAD's `yeoman`) is shown with a capital letter, as EOS lowercases it. */
function normalizeAge(word: string): string {
  const dashed = word.replace(/^50-70\+$/, '50–70+')
  return AGE_ORDER.find((age) => age.toLowerCase() === dashed.toLowerCase()) ?? dashed.charAt(0).toUpperCase() + dashed.slice(1)
}

/** The age may sit before or after the class word; take the first known one, else the first word left. */
function pickAge(words: string[]): string {
  const candidates = words.filter((w) => !CLASS_WORDS.has(w.toLowerCase())).map(normalizeAge)
  return candidates.find((w) => AGE_ORDER.includes(w)) ?? candidates[0] ?? ''
}

function unknownDivision(raw: string): DivisionName {
  const label = raw.trim()
  return { bow: '', age: '', gender: null, label, slug: slugify(label), known: false, sortKey: UNKNOWN_SORT_KEY }
}

export function parseDivisionName(raw: string): DivisionName {
  const trimmed = raw.trim()
  const bow = findBow(trimmed)
  if (!bow) return unknownDivision(raw)

  const words = trimmed.slice(bow.length).split(/\s+/).filter(Boolean)
  const gender = GENDERS[(words[words.length - 1] ?? '').toLowerCase()] ?? null
  const age = pickAge(gender ? words.slice(0, -1) : words)
  const ageIndex = AGE_ORDER.indexOf(age)
  const label = [bow.entry.display, age, gender].filter(Boolean).join(' ')

  return {
    bow: bow.entry.display,
    age,
    gender,
    label,
    slug: slugify(label),
    known: true,
    sortKey: [bow.entry.index, ageIndex === -1 ? UNKNOWN_AGE_INDEX : ageIndex, gender ? GENDER_ORDER[gender] : 2],
  }
}

export function compareDivisions(a: DivisionName, b: DivisionName): number {
  for (let i = 0; i < 3; i++) {
    const diff = (a.sortKey[i] ?? 0) - (b.sortKey[i] ?? 0)
    if (diff !== 0) return diff
  }
  return a.label.localeCompare(b.label)
}
