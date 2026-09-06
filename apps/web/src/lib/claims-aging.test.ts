import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLAIM_REVIEW_BREACH_HOURS,
  agingClaimsSummary,
  agingPaidClaims,
  claimIsPaid,
} from './claims-aging'

// The failure this guards is not a crash — it is a business that paid for a
// listing upgrade and simply never received it because one person was busy. So
// the tests are mostly about what must NOT be filtered out.

const HOUR = 3_600_000
const NOW = Date.parse('2026-09-06T00:00:00Z')
const agoHours = (h: number) => new Date(NOW - h * HOUR).toISOString()

test('a claim counts as paid when money is actually attached to it', () => {
  assert.equal(claimIsPaid({ id: 'a', stripe_subscription_id: 'sub_1' }), true)
  assert.equal(claimIsPaid({ id: 'b', pending_tier: 'premium' }), true)
  assert.equal(claimIsPaid({ id: 'c', pending_tier: 'featured' }), true)

  // A free Basic claim waiting for review costs the claimant nothing, so it is
  // not what we page an operator about at 3am.
  assert.equal(claimIsPaid({ id: 'd', pending_tier: 'basic' }), false)
  assert.equal(claimIsPaid({ id: 'e' }), false)
  assert.equal(claimIsPaid({ id: 'f', stripe_subscription_id: '' }), false)
})

test('only paid claims still awaiting approval are reported', () => {
  const claims = [
    { id: 'paid-old', claim_status: 'pending_approval', pending_tier: 'premium', claimed_at: agoHours(100) },
    // Already approved - not waiting on anyone.
    { id: 'approved', claim_status: 'approved', pending_tier: 'premium', claimed_at: agoHours(100) },
    // Free claim - no money at stake.
    { id: 'free', claim_status: 'pending_approval', pending_tier: 'basic', claimed_at: agoHours(100) },
    // Paid but only just submitted - inside the review window.
    { id: 'fresh', claim_status: 'pending_approval', pending_tier: 'premium', claimed_at: agoHours(2) },
  ]
  const aging = agingPaidClaims(claims, NOW)
  assert.deepEqual(aging.map((c) => c.id), ['paid-old'])
})

test('the longest wait is reported first, and a breach is flagged', () => {
  const claims = [
    { id: 'three-days', claim_status: 'pending_approval', stripe_subscription_id: 's1', claimed_at: agoHours(72) },
    { id: 'ten-days', claim_status: 'pending_approval', stripe_subscription_id: 's2', claimed_at: agoHours(240) },
    { id: 'two-days', claim_status: 'pending_approval', stripe_subscription_id: 's3', claimed_at: agoHours(49) },
  ]
  const aging = agingPaidClaims(claims, NOW)
  assert.deepEqual(aging.map((c) => c.id), ['ten-days', 'three-days', 'two-days'])
  assert.equal(aging[0].breached, true)
  assert.equal(aging[0].hours_waiting, 240)
  // 72h is past the 48h target but inside the 120h breach line.
  assert.equal(aging[1].breached, false)
  assert.ok(CLAIM_REVIEW_BREACH_HOURS > 72)
})

test('the clock runs from when they claimed, not from the last edit', () => {
  // Any admin action that touches the document would otherwise reset the clock
  // and hide a claim that has genuinely been waiting for weeks - which is exactly
  // the case an operator most needs to see.
  const claim = {
    id: 'x',
    claim_status: 'pending_approval',
    pending_tier: 'premium',
    claimed_at: agoHours(500),
    updated_at: agoHours(1),
  }
  const aging = agingPaidClaims([claim], NOW)
  assert.equal(aging.length, 1)
  assert.equal(aging[0].hours_waiting, 500)
})

test('a paid claim we cannot date is surfaced, not silently dropped', () => {
  // "We do not know how long this has waited" must never read as "it is fine".
  const claims = [
    { id: 'undated', claim_status: 'pending_approval', pending_tier: 'premium' },
    { id: 'old', claim_status: 'pending_approval', pending_tier: 'premium', claimed_at: agoHours(200) },
  ]
  const aging = agingPaidClaims(claims, NOW)
  assert.equal(aging.length, 2)
  assert.equal(aging[0].id, 'undated', 'unknown age sorts to the top for a human to look at')
  assert.equal(aging[0].hours_waiting, -1)
  assert.equal(aging[0].breached, true)
})

test('Firestore Timestamp shapes are understood, not treated as undateable', () => {
  const asTimestamp = { _seconds: Math.floor((NOW - 200 * HOUR) / 1000) }
  const asToDate = { toDate: () => new Date(NOW - 200 * HOUR) }
  for (const claimed of [asTimestamp, asToDate]) {
    const aging = agingPaidClaims(
      [{ id: 'x', claim_status: 'pending_approval', pending_tier: 'premium', claimed_at: claimed }],
      NOW
    )
    assert.equal(aging[0].hours_waiting, 200)
  }
})

test('the summary says plainly that these customers paid and got nothing', () => {
  assert.match(agingClaimsSummary([]), /No paid claims are overdue/)
  const aging = agingPaidClaims(
    [{ id: 'x', name: 'Tacos El Rey', claim_status: 'pending_approval', pending_tier: 'premium', claimed_at: agoHours(240) }],
    NOW
  )
  const line = agingClaimsSummary(aging)
  assert.match(line, /Tacos El Rey/)
  assert.match(line, /have been charged/)
})
