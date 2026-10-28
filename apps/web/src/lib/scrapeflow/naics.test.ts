import { test } from 'node:test'
import assert from 'node:assert/strict'
import { naicsCategory } from './naics'
import { DIRECTORY_CATEGORIES } from '@/lib/categories'

// The failure this file pins down: the Texas Comptroller feed — the directory's
// only reliably growing source — filed all 19,286 El Paso businesses under one
// blanket category. The first batch put Trevino Donuts, Grid Golf Company and a
// wireless dealer in "Professional Services". The dataset carried
// `outlet_naics_code` the whole time and nothing read it.
//
// Measured against the live distribution on 2026-10-28: 810 distinct codes,
// 19,267 businesses, 99.8% mapped, 45 falling back (NAICS 551 holding companies
// and 92 public administration — correctly not directory businesses).

test('the specific rows that exposed the bug now categorise correctly', () => {
  // Real codes from the 19 rows imported on 2026-10-28.
  assert.equal(naicsCategory('722330'), 'Restaurant') // mobile food services
  assert.equal(naicsCategory('445292'), 'Retail') // confectionery/nut stores
  assert.equal(naicsCategory('711510'), 'Arts & Culture') // independent artists
  assert.equal(naicsCategory('452319'), 'Retail') // general merchandise
  assert.equal(naicsCategory('713910'), 'Fitness') // golf courses
})

test('longest prefix wins, so a specific code beats its own sector', () => {
  // 72 is Restaurant as a sector, but these three are not restaurants.
  assert.equal(naicsCategory('72'), 'Restaurant')
  assert.equal(naicsCategory('722410'), 'Bar') // drinking places
  assert.equal(naicsCategory('722515'), 'Coffee Shop') // snack/nonalcoholic bars
  assert.equal(naicsCategory('722320'), 'Event Services') // caterers

  // 44 is Retail, but car dealers and parts stores have their own verticals.
  assert.equal(naicsCategory('44'), 'Retail')
  assert.equal(naicsCategory('441110'), 'Auto Dealer')
  assert.equal(naicsCategory('441330'), 'Auto Repair')
  assert.equal(naicsCategory('446110'), 'Health') // pharmacies

  // 23 is Home Services, but electricians have a dedicated vertical that the
  // sales pipeline targets by name.
  assert.equal(naicsCategory('23'), 'Home Services')
  assert.equal(naicsCategory('238210'), 'Electrical Contractors')
  assert.equal(naicsCategory('238290'), 'Automation & Controls')

  // 54 is Professional Services; the high-value verticals split out of it.
  assert.equal(naicsCategory('54'), 'Professional Services')
  assert.equal(naicsCategory('541110'), 'Attorneys')
  assert.equal(naicsCategory('541191'), 'Title & Notary')
  assert.equal(naicsCategory('541512'), 'Web Development')
  assert.equal(naicsCategory('541810'), 'Marketing')
  assert.equal(naicsCategory('541211'), 'Financial')
})

test('NAICS 531 splits three audiences instead of calling them all Real Estate', () => {
  // Measured in El Paso County: 9 agent/broker offices against 30 residential
  // lessors and 57 self-storage operators. One category made the Real Estate
  // page read as an apartment list.
  assert.equal(naicsCategory('531210'), 'Real Estate', 'agents and brokers')
  assert.equal(naicsCategory('531311'), 'Real Estate', 'property managers')
  assert.equal(naicsCategory('531320'), 'Real Estate', 'appraisers')
  assert.equal(naicsCategory('531110'), 'Apartments & Rentals', 'residential lessors')
  assert.equal(naicsCategory('531130'), 'Self Storage', 'miniwarehouses')
  // Commercial and land leasing stays Real Estate: that IS what a business
  // searching for premises means by it.
  assert.equal(naicsCategory('531120'), 'Real Estate', 'nonresidential lessors')
  assert.equal(naicsCategory('531190'), 'Real Estate', 'other real estate lessors')
  // The sector default must not be dragged along by the new specifics.
  assert.equal(naicsCategory('531'), 'Real Estate')
  assert.equal(naicsCategory('53'), 'Real Estate')
})

test('title insurance carriers reach Title & Notary, not Insurance', () => {
  // Sierra Title, Weststar Title and Chicago Title all carry 524127 and were
  // filed under Insurance by the 5241 prefix.
  assert.equal(naicsCategory('524127'), 'Title & Notary')
  assert.equal(naicsCategory('524128'), 'Title & Notary')
  // Real insurance is untouched.
  assert.equal(naicsCategory('524210'), 'Insurance', 'agencies and brokerages')
  assert.equal(naicsCategory('524113'), 'Insurance', 'direct life carriers')
  assert.equal(naicsCategory('524126'), 'Insurance', 'direct property carriers')
  assert.equal(naicsCategory('524291'), 'Insurance', 'claims adjusters')
})

test('an unmapped code returns null rather than a guess', () => {
  // These are the real fall-throughs. They must NOT be invented into a
  // category: a wrong category is invisible because it looks categorised,
  // whereas null leaves the caller's honest default in place.
  assert.equal(naicsCategory('551114'), null) // corporate managing offices
  assert.equal(naicsCategory('921190'), null) // public administration
  assert.equal(naicsCategory('99'), null)
  assert.equal(naicsCategory('00'), null)
})

test('government feeds emit loose shapes, and none of them may throw', () => {
  assert.equal(naicsCategory(722511), 'Restaurant', 'a number, not a string')
  assert.equal(naicsCategory(' 722511 '), 'Restaurant', 'padded')
  assert.equal(naicsCategory('722511.0'), 'Restaurant', 'a float from a CSV')
  assert.equal(naicsCategory('722-511'), 'Restaurant', 'punctuation stripped')
  // Too short to carry sector information.
  assert.equal(naicsCategory('7'), null)
  assert.equal(naicsCategory(''), null)
  assert.equal(naicsCategory(null), null)
  assert.equal(naicsCategory(undefined), null)
  assert.equal(naicsCategory({}), null)
  assert.equal(naicsCategory([]), null)
})

test('a longer code falls back to the nearest known prefix', () => {
  // 7225 is not in the table, but 722 is: a 6-digit code nobody enumerated
  // still lands somewhere defensible instead of returning null.
  assert.equal(naicsCategory('722999'), 'Restaurant')
  assert.equal(naicsCategory('238999'), 'Home Services')
})

test('every category the table can emit is a real browse category', () => {
  // A value outside DIRECTORY_CATEGORIES would be written into
  // listing.category and then match no browse page, no slug and no facet.
  // naics.ts validates this at import; this asserts it stays validated, and
  // that the sweep below actually exercised the table rather than passing
  // vacuously.
  const allowed = new Set<string>(DIRECTORY_CATEGORIES)
  const seen = new Set<string>()
  for (let sector = 10; sector <= 99; sector++) {
    for (const suffix of ['', '0', '1', '2', '3', '4', '5', '9', '110', '210', '510', '999']) {
      const category = naicsCategory(`${sector}${suffix}`)
      if (category === null) continue
      assert.ok(allowed.has(category), `"${category}" is not a DIRECTORY_CATEGORY`)
      seen.add(category)
    }
  }
  assert.ok(seen.size >= 15, `expected the sweep to reach many categories, reached ${seen.size}`)
})
