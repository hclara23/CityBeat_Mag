import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayHoursLabel, hasUsableHours, parseOsmOpeningHours, resolveHours } from './directory-hours'

// ---------------------------------------------------------------------------
// The bug these exist to prevent. Across a 4,000-listing sample of the live
// collection, 3,998 listings rendered "Closed" on all seven days because `{}`
// is truthy and every missing day fell back to that literal string.
// ---------------------------------------------------------------------------

test('an empty hours map yields nothing, so the panel is hidden rather than claiming Closed', () => {
  // 3,836 of the sample are exactly this.
  assert.equal(resolveHours({}), null)
  assert.equal(hasUsableHours({}), false)
})

test('absent, null and non-object hours are all "unknown", never "closed"', () => {
  for (const input of [undefined, null, '', 'closed', 0, [], [['Monday', '9-5']]]) {
    assert.equal(hasUsableHours(input), false)
  }
})

test('a day with no value reads as unknown, not as closed', () => {
  // A business that listed Monday-Friday has NOT told us it is shut at the
  // weekend. Returning null lets the page print a neutral dash.
  const perDay = resolveHours({ Monday: '9:00 AM - 5:00 PM' })
  assert.equal(dayHoursLabel(perDay, 'Monday', 'en'), '9:00 AM - 5:00 PM')
  assert.equal(dayHoursLabel(perDay, 'Sunday', 'en'), null)
})

// --- shape 2: per-day keys, as the owner editor writes them -----------------

test('per-day keys are read as-is', () => {
  const perDay = resolveHours({ Monday: '9:00 AM - 9:00 PM', Sunday: 'Closed' })
  assert.equal(perDay?.Monday, '9:00 AM - 9:00 PM')
  assert.equal(perDay?.Sunday, 'Closed')
})

test('per-day keys are matched case-insensitively', () => {
  // The ingest and the editor have not always agreed on capitalisation, and a
  // lowercase key held real hours the page refused to read.
  const perDay = resolveHours({ monday: '8:00 AM - 4:00 PM' })
  assert.equal(perDay?.Monday, '8:00 AM - 4:00 PM')
})

test('blank per-day values do not count as data', () => {
  assert.equal(resolveHours({ Monday: '   ', Tuesday: '' }), null)
})

// --- shape 3: the OSM spec string the Overpass ingest actually stores -------
// Every literal below is a real value read from the live collection.

test('real stored OSM specs parse into the days they describe', () => {
  // Taco Bell, live data.
  const bell = parseOsmOpeningHours('Mo-Th 08:00-02:00; Fr-Sa 08:00-03:00; Su 08:00-02:00')
  assert.equal(bell?.Monday, '8:00 AM - 2:00 AM')
  assert.equal(bell?.Thursday, '8:00 AM - 2:00 AM')
  assert.equal(bell?.Friday, '8:00 AM - 3:00 AM')
  assert.equal(bell?.Saturday, '8:00 AM - 3:00 AM')
  assert.equal(bell?.Sunday, '8:00 AM - 2:00 AM')

  // Chick-fil-A, live data — the "Su off" rule is a genuine closure and must
  // survive as one.
  const cfa = parseOsmOpeningHours('Mo-Sa 06:30-22:00; Su off')
  assert.equal(cfa?.Monday, '6:30 AM - 10:00 PM')
  assert.equal(cfa?.Sunday, 'Closed')

  // pepenadores / Pupusona Pellicano, live data.
  assert.equal(parseOsmOpeningHours('Mo-Fr 08:00-17:00')?.Friday, '8:00 AM - 5:00 PM')
  assert.equal(parseOsmOpeningHours('Tu-Su 17:00-23:00')?.Sunday, '5:00 PM - 11:00 PM')
})

test('a bare time range with no day list applies to every day', () => {
  // Taco Bell, live data: '10:30-21:00'.
  const all = parseOsmOpeningHours('10:30-21:00')
  for (const day of ['Monday', 'Wednesday', 'Sunday'] as const) {
    assert.equal(all?.[day], '10:30 AM - 9:00 PM')
  }
})

test('24/7 is every day, not a parse failure', () => {
  assert.equal(parseOsmOpeningHours('24/7')?.Tuesday, 'Open 24 hours')
})

test('a day range that wraps past Sunday includes the days it wraps through', () => {
  const r = parseOsmOpeningHours('Fr-Mo 10:00-14:00')
  assert.equal(r?.Friday, '10:00 AM - 2:00 PM')
  assert.equal(r?.Saturday, '10:00 AM - 2:00 PM')
  assert.equal(r?.Sunday, '10:00 AM - 2:00 PM')
  assert.equal(r?.Monday, '10:00 AM - 2:00 PM')
  assert.equal(r?.Wednesday, undefined)
})

test('comma day lists and split shifts both parse', () => {
  assert.equal(parseOsmOpeningHours('Mo,We,Fr 09:00-17:00')?.Wednesday, '9:00 AM - 5:00 PM')
  assert.equal(parseOsmOpeningHours('Tu-Th 09:00-12:00')?.Tuesday, '9:00 AM - 12:00 PM')
  assert.equal(
    parseOsmOpeningHours('Mo 08:00-12:00,13:00-17:00')?.Monday,
    '8:00 AM - 12:00 PM, 1:00 PM - 5:00 PM'
  )
})

// --- the refusals, which matter more than the successes --------------------
// A parser that guesses publishes WRONG hours. That is the same harm as the
// false "Closed" wearing a different hat, so anything not fully modelled must
// come back null and let the page say the hours are not listed.

test('grammar we do not model is refused whole, never partially applied', () => {
  // A seasonal window would otherwise be published as year-round hours.
  assert.equal(parseOsmOpeningHours('Jan 01-Mar 31 10:00-16:00'), null)
  // Public and school holidays.
  assert.equal(parseOsmOpeningHours('Mo-Fr 09:00-17:00; PH off'), null)
  // Sun-relative times vary by date.
  assert.equal(parseOsmOpeningHours('Mo-Su sunrise-sunset'), null)
  // Week selectors and comment syntax.
  assert.equal(parseOsmOpeningHours('week 1-52/2 Mo 10:00-12:00'), null)
  assert.equal(parseOsmOpeningHours('Mo-Fr 09:00-17:00 ||"by appointment"'), null)
})

test('malformed or nonsense specs are refused rather than coerced', () => {
  for (const spec of ['', '   ', 'yes', 'Mo-', 'Mo 9-5', 'Mo 09:00', 'Xx 09:00-17:00', 'Mo 25:99-26:00']) {
    assert.equal(parseOsmOpeningHours(spec), null, `expected null for ${JSON.stringify(spec)}`)
  }
})

test('one unreadable rule invalidates the whole spec', () => {
  // The readable half describes Mo-Fr; publishing just that would silently drop
  // the Saturday rule the business actually set.
  assert.equal(parseOsmOpeningHours('Mo-Fr 09:00-17:00; Sa sunset-23:00'), null)
})

// --- localisation ----------------------------------------------------------

test('Spanish translates the two fixed labels and leaves times alone', () => {
  const perDay = resolveHours({ Monday: 'Closed', Tuesday: 'Open 24 hours', Wednesday: '9:00 AM - 5:00 PM' })
  assert.equal(dayHoursLabel(perDay, 'Monday', 'es'), 'Cerrado')
  assert.equal(dayHoursLabel(perDay, 'Tuesday', 'es'), 'Abierto las 24 horas')
  assert.equal(dayHoursLabel(perDay, 'Wednesday', 'es'), '9:00 AM - 5:00 PM')
})

test('an unknown day is null in Spanish too, not Cerrado', () => {
  assert.equal(dayHoursLabel(resolveHours({ Monday: 'Closed' }), 'Friday', 'es'), null)
})

test('a parsed OSM closure still localises', () => {
  const perDay = resolveHours({ opening_hours: 'Mo-Sa 06:30-22:00; Su off' })
  assert.equal(dayHoursLabel(perDay, 'Sunday', 'es'), 'Cerrado')
  assert.equal(hasUsableHours({ opening_hours: 'Mo-Sa 06:30-22:00; Su off' }), true)
})

test('an OSM spec we cannot parse leaves the listing with no hours at all', () => {
  assert.equal(hasUsableHours({ opening_hours: 'Mo-Su sunrise-sunset' }), false)
})
