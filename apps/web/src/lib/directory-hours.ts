// Opening hours, and why this module exists.
//
// The directory told the public that essentially every business in El Paso was
// closed seven days a week. Measured across a 4,000-listing sample of the live
// collection, 3,998 rendered "Closed" for all seven days and 2 correctly showed
// nothing. The listing page gated the hours panel on `listing.hours` being
// truthy and then fell back to the literal string 'Closed' for any day with no
// value — and `{}` is truthy in JavaScript, so an empty map rendered a full week
// of "Closed".
//
// That is worse than showing nothing. It is a false factual claim about a real
// business, published in a directory whose purpose is to send customers to that
// business, on the very Premium tier we ask owners to pay for. No owner pays for
// a page that says they are shut.
//
// The stored data comes in three shapes, all of which this module reads:
//
//   1. {}                      — 3,836 of the sample. No hours known. Show nothing.
//   2. { Monday: '9:00 AM - 9:00 PM', ... } — 24 of the sample. What the owner
//      editor writes. Already worked.
//   3. { opening_hours: 'Mo-Th 08:00-02:00; Fr-Sa 08:00-03:00; Su 08:00-02:00' }
//      — 138 of the sample. The raw OSM spec string the Overpass ingest stores.
//      The page looked for hours['Monday'], found nothing, and printed "Closed"
//      all week while the real hours sat in the same document.
//
// The parser is deliberately CONSERVATIVE. OSM's opening_hours grammar is large
// (public holidays, seasons, date ranges, sunset offsets, week numbers), and a
// parser that guesses at a rule it does not model would publish wrong hours —
// which is the same harm in a new costume. Anything not fully understood returns
// null, and the page then says the hours are not listed. Saying "we don't know"
// is always safe; saying "closed" or inventing a time is not.

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export type DayName = (typeof DAY_NAMES)[number]
export type PerDayHours = Partial<Record<DayName, string>>

/** OSM's two-letter day abbreviations, in the order its ranges count through. */
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

// Exact strings, because the listing page's Spanish rendering matches on them
// (/^(closed|open 24 hours)$/i). Changing them silently drops the translation.
const CLOSED = 'Closed'
const ALL_DAY = 'Open 24 hours'

/**
 * Grammar we do NOT model. A spec containing any of these is rejected whole
 * rather than partially understood: a rule like "Mo-Fr 09:00-17:00; PH off"
 * could be read as weekday hours, but "Jan 01-Mar 31 10:00-16:00" means those
 * hours apply only in that date window, and publishing them year-round is wrong.
 */
const UNSUPPORTED =
  /(\bPH\b|\bSH\b|\beaster\b|sunrise|sunset|dawn|dusk|\bweek\b|\bopen\b|\d{4}|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b|[[\]|])/i

const DAY_SPEC = '(?:Mo|Tu|We|Th|Fr|Sa|Su)'
const DAY_LIST = new RegExp(`^(${DAY_SPEC}(?:-${DAY_SPEC})?(?:,${DAY_SPEC}(?:-${DAY_SPEC})?)*)$`, 'i')
const TIME_RANGES = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:,\d{1,2}:\d{2}-\d{1,2}:\d{2})*$/

function osmIndex(abbr: string): number {
  return OSM_DAYS.findIndex((d) => d.toLowerCase() === abbr.toLowerCase())
}

/** "Mo-Fr" / "Sa,Su" / "Fr-Mo" (which wraps through Sunday) -> day names. */
function expandDays(spec: string): DayName[] | null {
  if (!DAY_LIST.test(spec)) return null
  const out = new Set<DayName>()
  for (const token of spec.split(',')) {
    const [fromRaw, toRaw] = token.split('-')
    const from = osmIndex(fromRaw.trim())
    if (from < 0) return null
    if (toRaw === undefined) {
      out.add(DAY_NAMES[from])
      continue
    }
    const to = osmIndex(toRaw.trim())
    if (to < 0) return null
    // Ranges wrap: Fr-Mo is Friday, Saturday, Sunday, Monday.
    for (let i = 0; i <= (to - from + 7) % 7; i++) out.add(DAY_NAMES[(from + i) % 7])
  }
  return [...out]
}

/** "08:00" -> "8:00 AM". Rejects times outside a real clock. */
function to12Hour(hhmm: string): string | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return null
  // OSM writes a closing time past midnight as 24:00 up to 48:00; normalise into
  // a single day rather than dropping a late-night bar's real closing time.
  if (h > 48) return null
  const h24 = h % 24
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m[2]} ${suffix}`
}

function formatRanges(spec: string): string | null {
  const parts: string[] = []
  for (const range of spec.split(',')) {
    const [open, close] = range.split('-')
    const a = to12Hour(open)
    const b = to12Hour(close)
    if (!a || !b) return null
    parts.push(`${a} - ${b}`)
  }
  return parts.join(', ')
}

/**
 * Parse an OSM `opening_hours` spec into per-day labels, or null when any part
 * of it is not fully understood. Never partially applies a spec: a half-read
 * rule set publishes hours for days it never actually described.
 */
export function parseOsmOpeningHours(raw: unknown): PerDayHours | null {
  const spec = String(raw ?? '').trim()
  if (!spec) return null
  if (/^24\/7$/i.test(spec)) {
    return Object.fromEntries(DAY_NAMES.map((d) => [d, ALL_DAY])) as PerDayHours
  }
  if (UNSUPPORTED.test(spec)) return null

  const out: PerDayHours = {}
  for (const rule of spec.split(';')) {
    const trimmed = rule.trim()
    if (!trimmed) continue

    // Split the leading day list from the rest. A rule with no day list ("10:30-21:00")
    // applies to every day, which is how OSM records a business open the same
    // hours daily.
    const firstSpace = trimmed.search(/\s/)
    let daysPart = ''
    let timePart = trimmed
    if (firstSpace > 0 && DAY_LIST.test(trimmed.slice(0, firstSpace))) {
      daysPart = trimmed.slice(0, firstSpace)
      timePart = trimmed.slice(firstSpace + 1).trim()
    }
    if (!timePart) return null

    const days = daysPart ? expandDays(daysPart) : [...DAY_NAMES]
    if (!days || !days.length) return null

    let label: string
    if (/^(off|closed)$/i.test(timePart)) label = CLOSED
    else if (/^24\/7$/i.test(timePart)) label = ALL_DAY
    else {
      if (!TIME_RANGES.test(timePart)) return null
      const formatted = formatRanges(timePart)
      if (!formatted) return null
      label = formatted
    }
    for (const day of days) out[day] = label
  }

  return Object.keys(out).length ? out : null
}

/**
 * Read whichever stored shape this listing uses and return per-day labels, or
 * null when nothing usable is on file. Null is the signal to render no hours
 * panel at all — NOT to render a week of "Closed".
 */
export function resolveHours(hours: unknown): PerDayHours | null {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null
  const record = hours as Record<string, unknown>

  // Shape 2: per-day keys, as the owner editor writes them. Case-insensitive
  // because the ingest and the editor have not always agreed on capitalisation,
  // and a lowercase key held real hours the page silently refused to read.
  const lower = new Map<string, unknown>()
  for (const [key, value] of Object.entries(record)) lower.set(key.toLowerCase(), value)

  const perDay: PerDayHours = {}
  for (const day of DAY_NAMES) {
    const value = lower.get(day.toLowerCase())
    if (typeof value === 'string' && value.trim()) perDay[day] = value.trim()
  }
  if (Object.keys(perDay).length) return perDay

  // Shape 3: a raw OSM spec string.
  const osm = lower.get('opening_hours') ?? lower.get('openinghours')
  if (typeof osm === 'string') return parseOsmOpeningHours(osm)

  return null
}

/** Is there anything real to show? The gate for rendering the hours panel. */
export function hasUsableHours(hours: unknown): boolean {
  return resolveHours(hours) !== null
}

/**
 * The label for one day, localised, or null when that day is unknown.
 *
 * Null is returned rather than 'Closed'. A business that listed Monday-Friday
 * has not told us it is shut at the weekend, and we must not say so on its
 * behalf — the caller renders a neutral dash instead.
 */
export function dayHoursLabel(
  perDay: PerDayHours | null,
  day: DayName,
  locale: string
): string | null {
  const value = perDay?.[day]
  if (!value || !value.trim()) return null
  if (locale !== 'es') return value
  if (/^closed$/i.test(value)) return 'Cerrado'
  if (/^open 24 hours$/i.test(value)) return 'Abierto las 24 horas'
  return value
}
