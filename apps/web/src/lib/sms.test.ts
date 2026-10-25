import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toE164 } from './sms'

// ---------------------------------------------------------------------------
// Every literal below is a real shape taken from the live directory_listings
// collection (a 300-row sample: 179 bare-10-digit, 105 plus-with-separators,
// 1 nine-digit). Twilio does not infer a country code, so before this module
// normalised them NOT ONE stored number was in a form Twilio accepts.
// ---------------------------------------------------------------------------

test('the common stored form — ten digits, no country code — becomes E.164', () => {
  assert.equal(toE164('(915) 772-9287'), '+19157729287')
  assert.equal(toE164('915-772-9287'), '+19157729287')
  assert.equal(toE164('9157729287'), '+19157729287')
  assert.equal(toE164('915.772.9287'), '+19157729287')
})

test('a leading 1, with or without a plus, is the country code and not an area code', () => {
  assert.equal(toE164('+1 915-842-8548'), '+19158428548')
  assert.equal(toE164('1-915-842-8548'), '+19158428548')
  assert.equal(toE164('+19158428548'), '+19158428548')
})

test('surrounding whitespace and an extension-free label do not defeat it', () => {
  assert.equal(toE164('  +1 (915) 842-8548  '), '+19158428548')
})

// --- the refusals ----------------------------------------------------------
// These matter more than the successes. A normaliser that guesses turns a
// typo into a text message delivered to whoever owns the number it guessed.

test('a number that cannot be NANP is refused rather than repaired', () => {
  // Live listing data. Area code 195 is forbidden by the NANP — almost
  // certainly a mistyped 915 number, and the one case where sending anything
  // at all would reach the wrong person.
  assert.equal(toE164('1952611098'), null)
  // Area and exchange codes may not begin with 0 or 1.
  assert.equal(toE164('(015) 772-9287'), null)
  assert.equal(toE164('(915) 172-9287'), null)
})

test('too few or too many digits is refused', () => {
  assert.equal(toE164('963 25 15 81'), null) // nine digits, from the live sample
  assert.equal(toE164('915-7729'), null)
  assert.equal(toE164('9157729287123456'), null)
})

test('empty, missing and junk values are refused, not coerced', () => {
  assert.equal(toE164(''), null)
  assert.equal(toE164('   '), null)
  assert.equal(toE164(null), null)
  assert.equal(toE164(undefined), null)
  assert.equal(toE164('call for hours'), null)
  assert.equal(toE164('n/a'), null)
})

test('a stated non-NANP country code is taken at its word, never re-dialled as US', () => {
  // Ciudad Juarez is across the bridge and in the directory's region; a +52
  // number must survive untouched.
  assert.equal(toE164('+52 656 123 4567'), '+526561234567')
  assert.equal(toE164('+44 7911 123456'), '+447911123456')
})

test('a plus-prefixed short number is not salvaged into a US number', () => {
  // '+4479111234' is a truncated UK number. Treating its first ten digits as
  // NANP would yield a valid-looking +14479111234 and text a stranger.
  assert.equal(toE164('+4479111234'), '+4479111234')
})

test('normalising is idempotent', () => {
  const once = toE164('(915) 772-9287')!
  assert.equal(toE164(once), once)
})
