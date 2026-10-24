import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMappedValue } from './mapping'

// --- Fallback mapping ---------------------------------------------------------
//
// FMCSA populates dba_name on 24% of carriers and legal_name on 100% (measured
// over 600 live rows). Before this operator existed the choice was a name that
// was blank three times in four, or `dba_name+legal_name`, which CONCATENATES
// into "DBA LEGAL" for the quarter that have both.

test('a fallback picks the first alternative that has a value', () => {
  const row = { dba_name: 'Border Freight', legal_name: 'BORDER FREIGHT LLC' }
  assert.equal(getMappedValue(row, 'dba_name|legal_name'), 'Border Freight')
})

test('a fallback skips blank, empty and missing alternatives', () => {
  assert.equal(getMappedValue({ dba_name: '', legal_name: 'ACME LLC' }, 'dba_name|legal_name'), 'ACME LLC')
  assert.equal(getMappedValue({ dba_name: '   ', legal_name: 'ACME LLC' }, 'dba_name|legal_name'), 'ACME LLC')
  assert.equal(getMappedValue({ legal_name: 'ACME LLC' }, 'dba_name|legal_name'), 'ACME LLC')
})

test('a fallback with nothing usable returns null rather than an empty string', () => {
  // The caller treats null as "no name" and drops the row; '' would create a
  // nameless listing.
  assert.equal(getMappedValue({ dba_name: '', legal_name: '' }, 'dba_name|legal_name'), null)
  assert.equal(getMappedValue({}, 'dba_name|legal_name'), null)
})

test('alternation binds looser than concatenation', () => {
  // 'a+b|c' must mean "(a and b joined) otherwise c", so an alternative can
  // itself be a concatenation.
  assert.equal(getMappedValue({ first: 'Ana', last: 'Reyes' }, 'first+last|legal_name'), 'Ana Reyes')
  assert.equal(getMappedValue({ legal_name: 'ACME' }, 'first+last|legal_name'), 'ACME')
})

test('concatenation still works unchanged when no pipe is present', () => {
  assert.equal(getMappedValue({ a: 'X', b: 'Y' }, 'a+b'), 'X Y')
  assert.equal(getMappedValue({ a: 'X' }, 'a+b'), 'X')
})

test('a literal still wins over everything', () => {
  assert.equal(getMappedValue({ a: 'X' }, '=Restaurant|a'), 'Restaurant|a')
})
