import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JEV_SPAM_BELOW, costUsd, isJevSpam, jevCapUsd, jevKey, monthKey, underCap } from './jev'

test('the key is trimmed — a pasted leading space must not break auth', () => {
  assert.equal(jevKey({ JEV_API_KEY: ' apikey_abc ' }), 'apikey_abc')
  assert.equal(jevKey({ JEV_API_KEY: '   ' }), null)
  assert.equal(jevKey({}), null)
})

test('no cap means no calls — an uncapped paid API is a surprise bill', () => {
  assert.equal(jevCapUsd({}), null)
  assert.equal(jevCapUsd({ JEV_MONTHLY_CAP_USD: '0' }), null)
  assert.equal(jevCapUsd({ JEV_MONTHLY_CAP_USD: 'lots' }), null)
  assert.equal(jevCapUsd({ JEV_MONTHLY_CAP_USD: '5' }), 5)
  assert.equal(underCap(0, null), false)
})

test('spend stops at the cap, not after it', () => {
  assert.equal(underCap(4.99, 5), true)
  assert.equal(underCap(5, 5), false)
  assert.equal(underCap(NaN, 5), false)
})

test('cost counts input tokens only, at the published rate', () => {
  // The live test call: 359 input tokens.
  assert.ok(Math.abs(costUsd(359) - 0.000015078) < 1e-9)
  assert.equal(costUsd(undefined), 0)
  assert.equal(costUsd(-5), 0)
})

test('spend is bucketed per calendar month', () => {
  assert.equal(monthKey(new Date('2026-09-30T23:00:00Z')), 'usd_2026_09')
  assert.equal(monthKey(new Date('2026-10-01T00:00:00Z')), 'usd_2026_10')
})

test('only a confident "not genuine" counts as spam; no opinion never does', () => {
  assert.equal(JEV_SPAM_BELOW, 0.1)
  assert.equal(isJevSpam(0.05), true) // the real junk ad enquiry scored 0.05
  assert.equal(isJevSpam(0.1), false)
  assert.equal(isJevSpam(0.6), false)
  assert.equal(isJevSpam(null), false)
})
