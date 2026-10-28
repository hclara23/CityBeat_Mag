import { test } from 'node:test'
import assert from 'node:assert/strict'
import { officerIsEntity } from './fmcsa-registrant'

// Compares two fields within ONE census record. Cases are shaped like the real
// ones found auditing the 575 public FMCSA listings: 20 matched, 12 of them
// running a single truck.

test('the same person written in either order is the same entity', () => {
  assert.equal(officerIsEntity('LAURA A MARTINEZ', 'LAURA MARTINEZ'), true, 'middle initial')
  assert.equal(officerIsEntity('MARTINEZ LAURA', 'LAURA MARTINEZ'), true, 'surname first')
  assert.equal(officerIsEntity('Laura Martinez', 'LAURA MARTINEZ'), true, 'case')
  assert.equal(officerIsEntity('LAURA, MARTINEZ', 'LAURA MARTINEZ'), true, 'punctuation')
})

test('an individual trading under a business suffix is still caught', () => {
  // Officer "JASON MORALES" against legal name "JASON MORALES TRUCKING": the
  // registrant is still one person even though the name looks commercial.
  assert.equal(officerIsEntity('JASON MORALES', 'JASON MORALES TRUCKING'), true)
  assert.equal(officerIsEntity('JASON MORALES TRUCKING', 'JASON MORALES'), true, 'symmetric')
  assert.equal(officerIsEntity('ABEL ORDONEZ', 'ABEL ORDONEZ LLC'), true)
})

test('a company run by a named person is NOT an individual', () => {
  assert.equal(officerIsEntity('JOHN SMITH', 'ACME FREIGHT LLC'), false)
  assert.equal(officerIsEntity('MARIA GARCIA', 'BORDER LOGISTICS GROUP INC'), false)
  // The officer's surname appearing in the company name is not enough: the
  // given name is missing from it.
  assert.equal(officerIsEntity('JOHN SMITH', 'SMITH TRUCKING LLC'), false)
})

test('a lone token proves nothing', () => {
  // A surname alone matches too many unrelated registrants.
  assert.equal(officerIsEntity('SMITH', 'SMITH TRUCKING LLC'), false)
  assert.equal(officerIsEntity('SMITH', 'SMITH'), false, 'one token on both sides still does not count')
  assert.equal(officerIsEntity('', 'LAURA MARTINEZ'), false)
})

test('missing or junk fields never match and never throw', () => {
  for (const [officer, legal] of [
    [undefined, 'LAURA MARTINEZ'],
    ['LAURA MARTINEZ', undefined],
    [null, null],
    ['', ''],
    ['   ', '  '],
    ['---', '###'],
    [42, 'LAURA MARTINEZ'],
  ] as Array<[unknown, unknown]>) {
    assert.equal(officerIsEntity(officer, legal), false, `${String(officer)} / ${String(legal)}`)
  }
})

test('the known false positive is recorded rather than hidden', () => {
  // Some filers type the company name into the officer field, so a company-style
  // name matches itself. The rule cannot tell these from an individual; it is a
  // review-and-hold signal where over-pulling is the safe direction, and
  // `--restore --only "<exact name>"` puts any single row back.
  assert.equal(officerIsEntity('J & E TRUCK', 'J & E TRUCK'), true)
  assert.equal(officerIsEntity('SIE TRUCKING AND SITE SOLUTIONS', 'SIE TRUCKING AND SITE SOLUTIONS'), true)
})
