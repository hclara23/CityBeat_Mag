import assert from 'node:assert/strict'
import test from 'node:test'
import { normBrandName } from './directory-consolidate'

test('normBrandName keeps leading digits (trade names commonly start with a number)', () => {
  assert.equal(normBrandName('1 A Electric'), '1aelectric')
  assert.equal(normBrandName('828 Electric LLC'), '828electric')
  assert.equal(normBrandName('828 Electric Llc'), '828electric', 'matches regardless of member casing')
  assert.equal(normBrandName('50 Plus Electric'), '50pluselectric')
  assert.equal(normBrandName('24 Hour Plumbing Co'), '24hourplumbing')
})

test('normBrandName strips a trailing store-number suffix', () => {
  assert.equal(normBrandName("Whataburger #1234"), 'whataburger')
  assert.equal(normBrandName('McDonald\'s'), 'mcdonalds')
  assert.equal(normBrandName('Store Name 5678'), 'storename')
})

test('normBrandName strips city/state/entity words and non-alphanumerics', () => {
  assert.equal(normBrandName('Acme Electric, Inc. - El Paso, TX'), 'acmeelectric')
  assert.equal(normBrandName(null), '')
  assert.equal(normBrandName(''), '')
})
