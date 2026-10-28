import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapCategory } from './normalize'

// mapCategory returns an exact DIRECTORY_CATEGORY unchanged, so these pass a
// BUSINESS NAME as `raw` — which is exactly how the keyword table is reached in
// production, via toCandidate for every AI-extracted listing whose category is
// not already canonical.
const guess = (name: string) => mapCategory(name, 'Professional Services')

// ─── the regressions ────────────────────────────────────────────────────────
// Found by auditing 565 FMCSA motor carriers against this table: it wanted to
// re-file 358 of them, almost entirely on substrings inside unrelated words.

test('a keyword inside a longer word no longer decides the category', () => {
  const cases: Array<[string, string]> = [
    // "art" inside "Mart"
    ['Martinez Trucking', 'art'],
    ['Martal Logistics Group LLC', 'art'],
    ['Smart Haul LLC', 'art'],
    ['Walmart Distribution', 'art'],
    ['Priority One Cartage & Dist', 'art'],
    // "spa" inside "Dispatch"
    ['Southern Base Dispatch Service', 'spa'],
    ['Spanish Trail Freight', 'spa'],
    // "venue" inside "Avenue"
    ['Montana Avenue Holdings', 'venue'],
    // "tax" inside "Taxi"
    ['Sun City Taxi', 'tax'],
    // "pub" inside "Republic"
    ['Republic Waste Hauling', 'pub'],
    // "store" inside "Restore" / "mall" inside "Smalley"
    ['Restore Hardware Freight', 'store'],
    ['Smalley Transport', 'mall'],
    // "bank" inside "Burbank", "hair" inside "Chair", "lash" inside "Flash"
    ['Burbank Logistics', 'bank'],
    ['Chairmasters Delivery', 'hair'],
    ['Flash Freight LLC', 'lash'],
    // "cars" inside "Oscars", "roof" inside "Waterproofing" is INTENDED to hit
    ['Oscars Hauling', 'cars'],
    // "cultur" inside "Agricultural"
    ['Agricultural Transport Co', 'cultur'],
  ]
  for (const [name, token] of cases) {
    const got = guess(name)
    assert.notEqual(
      got,
      // The category each bad token used to produce.
      {
        art: 'Arts & Culture',
        spa: 'Beauty',
        venue: 'Entertainment',
        tax: 'Financial',
        pub: 'Bar',
        store: 'Retail',
        mall: 'Retail',
        bank: 'Financial',
        hair: 'Beauty',
        lash: 'Beauty',
        cars: 'Auto Dealer',
        cultur: 'Arts & Culture',
      }[token],
      `"${name}" must not be categorised by the "${token}" inside another word (got ${got})`
    )
  }
})

test('the English word "it" no longer means information technology', () => {
  for (const name of ['Gun IT Hot Shot Services LLC', 'Keep IT Pushing LLC', 'Haul IT All LLC']) {
    assert.notEqual(guess(name), 'Web Development', `"${name}" is not an IT firm`)
  }
  // A real one still is.
  assert.equal(guess('Borderland IT Services'), 'Web Development')
  assert.equal(guess('Franklin Information Technology'), 'Web Development')
  assert.equal(guess('Mesa Software Group'), 'Web Development')
})

// ─── the matches that must survive ──────────────────────────────────────────
// A leading \b must not break the intentional prefix matches; over-tightening
// would be a quieter regression than the one being fixed.

test('intended prefix matches still work', () => {
  assert.equal(guess('El Paso Cultural Center'), 'Arts & Culture', 'cultur -> cultural')
  assert.equal(guess('Vargas Roofing'), 'Home Services', 'roof -> Roofing')
  assert.equal(guess('Sunland Realtors'), 'Real Estate', 'realt -> Realtors')
  assert.equal(guess('Rio Grande Banking Center'), 'Financial', 'bank -> Banking')
  assert.equal(guess('Hairstyling by Ana'), 'Beauty', 'hair -> Hairstyling')
  assert.equal(guess('Lashes & Brows Studio'), 'Beauty', 'lash -> Lashes')
  assert.equal(guess('Franklin Stores'), 'Retail', 'store -> Stores')
  assert.equal(guess('Eastside Cafeteria'), 'Cafe', 'caf[eé] stays open to Cafeteria')
  assert.equal(guess('Advertising Partners EP'), 'Marketing', 'advertis -> Advertising')
})

test('the plain whole words still match', () => {
  assert.equal(guess('Art Gallery of El Paso'), 'Arts & Culture')
  assert.equal(guess('Serenity Spa'), 'Beauty')
  assert.equal(guess('The Tap Pub'), 'Bar')
  assert.equal(guess('Cielo Vista Mall'), 'Retail')
  assert.equal(guess('Franklin Tax Service'), 'Financial')
  // Not "Bar None Cantina": `cantina` is in the Restaurant row, which is
  // checked first, so that name resolves to Restaurant by design.
  assert.equal(guess('The Corner Bar'), 'Bar')
  assert.equal(guess('Hoppy Trails Brewery'), 'Bar')
  assert.equal(guess('Used Cars El Paso'), 'Auto Dealer')
})

test('an exact category is returned untouched and never keyword-matched', () => {
  // The guard that keeps this table off anything already canonical.
  assert.equal(mapCategory('Logistics & Freight', 'Professional Services'), 'Logistics & Freight')
  assert.equal(mapCategory('Self Storage', 'Professional Services'), 'Self Storage')
  assert.equal(mapCategory('Apartments & Rentals', 'Professional Services'), 'Apartments & Rentals')
})

test('an unmatched name falls back rather than guessing', () => {
  assert.equal(mapCategory('Zzyzx Holdings LLC', 'Professional Services'), 'Professional Services')
  assert.equal(mapCategory('Zzyzx Holdings LLC', 'Retail'), 'Retail', 'caller fallback is honoured')
  // A fallback outside the taxonomy cannot leak through.
  assert.equal(mapCategory('Zzyzx Holdings LLC', 'Not A Category'), 'Professional Services')
})

test('two audit names stay ambiguous, and that is recorded rather than hidden', () => {
  // Neither is regex-fixable: "Bar D" is a Texas ranch brand and \bbar\b is
  // already as tight as a pattern gets, and "Dancer" genuinely begins with
  // "dance". Asserted so that a future change to either row is a deliberate
  // decision instead of an accident.
  assert.equal(guess('Diamond Bar D Livestock Transport'), 'Bar')
  assert.equal(guess('Wind Dancer Express'), 'Arts & Culture')
})
