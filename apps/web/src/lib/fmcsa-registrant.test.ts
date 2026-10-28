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

import { holdSignal, HOLD_REVIEWED_NOT_INDIVIDUAL } from './fmcsa-registrant'

test('each signal is reported on its own, and together as "both"', () => {
  const base = { officer: 'JOHN SMITH', legalName: 'ACME FREIGHT LLC', businessOrgDesc: '', reviewed: undefined }
  assert.equal(holdSignal(base), null, 'a company run by a named person')
  assert.equal(holdSignal({ ...base, officer: 'JASON MORALES', legalName: 'JASON MORALES TRUCKING' }), 'officer')
  assert.equal(holdSignal({ ...base, businessOrgDesc: 'INDIVIDUAL' }), 'registry', 'registry alone, officer differs')
  assert.equal(
    holdSignal({ ...base, officer: 'JASON MORALES', legalName: 'JASON MORALES', businessOrgDesc: 'INDIVIDUAL' }),
    'both'
  )
})

test('a recorded review outranks BOTH signals, so a restore is not undone by the next run', () => {
  // The regression this pins: restoring "J & E Truck" put it back, but the
  // officer rule still matched it, so re-running the hold script would have
  // re-held it and silently reversed the owner's decision.
  const company = { officer: 'J & E TRUCK', legalName: 'J & E TRUCK', businessOrgDesc: '' }
  assert.equal(holdSignal({ ...company, reviewed: undefined }), 'officer', 'unreviewed: still caught')
  assert.equal(holdSignal({ ...company, reviewed: HOLD_REVIEWED_NOT_INDIVIDUAL }), null, 'reviewed: left alone')
  // Even a registry-declared INDIVIDUAL yields to a person's explicit ruling.
  assert.equal(
    holdSignal({ officer: 'X Y', legalName: 'Z W', businessOrgDesc: 'INDIVIDUAL', reviewed: HOLD_REVIEWED_NOT_INDIVIDUAL }),
    null
  )
})

test('only the exact review marker counts', () => {
  const company = { officer: 'J & E TRUCK', legalName: 'J & E TRUCK', businessOrgDesc: '' }
  for (const reviewed of ['', 'yes', 'true', 'NOT_INDIVIDUAL', null, undefined, 1, true]) {
    assert.equal(holdSignal({ ...company, reviewed }), 'officer', `reviewed=${String(reviewed)} must not suppress the hold`)
  }
})
