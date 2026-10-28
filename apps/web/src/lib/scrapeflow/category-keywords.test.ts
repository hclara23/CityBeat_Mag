import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mapCategory } from './normalize'

// WHAT THIS FILE IS FOR.
//
// On 2026-10-28 I added \b word boundaries to CATEGORY_KEYWORDS, believing the
// substring matching was silently mis-filing listings. It was not, and the
// boundaries were reverted the same day. These tests pin the two facts that
// make the permissive matching correct, so the same "fix" is not attempted
// again from the same wrong premise.
//
// FACT ONE: the table's input is a CATEGORY LABEL, not a business name. That is
// why a mid-word match is safe — nobody passes "Martinez" as a category.
// FACT TWO: category labels in this market are routinely COMPOUNDS, so matching
// inside a word is the feature. Auditing all 29,430 live listings against the
// boundaried table found zero victims of the supposed bug and 60 rows the
// boundaries would have broken.

test('exactly one caller, and it passes a category label rather than a name', () => {
  // The whole justification for permissive matching. If a caller is ever added
  // that passes a NAME, this fails and the premise must be re-examined —
  // the fix then being a stricter matcher for that caller, not a tighter table.
  const src = readFileSync(fileURLToPath(new URL('./normalize.ts', import.meta.url)), 'utf8')
  const calls = [...src.matchAll(/mapCategory\(([^)]*)\)/g)]
    .map((m) => m[1].trim())
    .filter((args) => !args.startsWith('raw')) // the definition's own signature
  assert.deepEqual(calls, ['listing.category, opts.defaultCategory'], 'unexpected mapCategory call site')

  const whole = readFileSync(fileURLToPath(new URL('./normalize.ts', import.meta.url)), 'utf8')
  assert.ok(
    /Do not add \\b boundaries/.test(whole),
    'the reverted-boundaries rationale must stay next to the table it explains'
  )
})

test('compound category labels still match — the 60 rows boundaries would have broken', () => {
  // Each of these is a real published listing whose stored category the
  // boundaried table would have changed to something wrong.
  const cases: Array<[string, string]> = [
    ['Medspa', 'Beauty'],
    ['MedSpa', 'Beauty'],
    ['Eyelash Extensions', 'Beauty'],
    ['Dermaesthetics', 'Beauty'],
    ['Seafood', 'Restaurant'],
    ['Mexican Seafood', 'Restaurant'],
    ['MiSushi', 'Restaurant'],
    ['BuhosCantina', 'Restaurant'],
    ['Gymnasium', 'Fitness'],
    ['HVACGuys', 'Home Services'],
    ['Taxrite', 'Financial'],
    ['TEXASBANK', 'Financial'],
    ['Artwork', 'Arts & Culture'],
    ['ArtWorks', 'Arts & Culture'],
    ['ClintInsuranceAgency', 'Insurance'],
  ]
  for (const [label, expected] of cases) {
    assert.equal(
      mapCategory(label, 'Professional Services'),
      expected,
      `"${label}" must still reach ${expected} — a \\b boundary here would drop it`
    )
  }
})

test('the ordinary labels an extractor emits resolve as expected', () => {
  const cases: Array<[string, string]> = [
    ['Beauty Salon', 'Beauty'],
    ['Mexican Restaurant', 'Restaurant'],
    ['Coffee Shop', 'Coffee Shop'],
    ['Law Firm', 'Attorneys'],
    ['Real Estate Agency', 'Real Estate'],
    ['Insurance Agency', 'Insurance'],
    ['Electrical Contractor', 'Electrical Contractors'],
    ['Day Care', 'Childcare & Education'],
    ['Customs Broker', 'Logistics & Freight'],
    ['IT Services', 'Web Development'],
  ]
  for (const [label, expected] of cases) {
    assert.equal(mapCategory(label, 'Professional Services'), expected, label)
  }
})

test('an exact category is returned untouched, never keyword-matched', () => {
  // This short-circuit is why a workflow's blanket `Category` input is immune to
  // the table entirely — and why the Comptroller feeds, categorised from NAICS,
  // were never at risk.
  for (const c of ['Logistics & Freight', 'Self Storage', 'Apartments & Rentals', 'Professional Services']) {
    assert.equal(mapCategory(c, 'Retail'), c)
  }
  assert.equal(mapCategory('self storage', 'Retail'), 'Self Storage', 'case-insensitive exact match')
})

test('an unmatched label falls back, and a bogus fallback cannot leak through', () => {
  assert.equal(mapCategory('Zzyzx', 'Retail'), 'Retail')
  assert.equal(mapCategory('', 'Retail'), 'Retail')
  assert.equal(mapCategory(null, 'Retail'), 'Retail')
  assert.equal(mapCategory('Zzyzx', 'Not A Category'), 'Professional Services')
})
