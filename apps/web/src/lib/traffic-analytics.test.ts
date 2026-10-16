import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyProvider, normalizeRange } from './traffic-analytics'

test('traffic range accepts only supported windows', () => {
  assert.equal(normalizeRange('7'), 7)
  assert.equal(normalizeRange('90'), 90)
  assert.equal(normalizeRange('365'), 30)
  assert.equal(normalizeRange(null), 30)
})

test('provider failures are explicit and contain no invented metrics', () => {
  const report = emptyProvider('cloudflare', 'not_configured', 'missing')
  assert.equal(report.status, 'not_configured')
  assert.deepEqual(report.totals, { views: 0, visitors: 0, sessions: 0 })
  assert.deepEqual(report.trend, [])
})
