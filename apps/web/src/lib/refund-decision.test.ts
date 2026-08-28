import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOriginatingRefund, isPartialRefund, refundListingPatch } from './refund-decision'

// These pin the two money regressions from 2026-08-28 as executable invariants.

test('a renewal refund is NOT the originating charge (regression #2)', () => {
  // A payment-intent match is always the exact payment.
  assert.equal(isOriginatingRefund({ matchedByPaymentIntent: true }), true)
  // The subscription's FIRST invoice is the sale.
  assert.equal(isOriginatingRefund({ matchedByPaymentIntent: false, invoiceBillingReason: 'subscription_create' }), true)
  // A RENEWAL invoice is not — refunding month 4 must not reverse the sale.
  assert.equal(isOriginatingRefund({ matchedByPaymentIntent: false, invoiceBillingReason: 'subscription_cycle' }), false)
  assert.equal(isOriginatingRefund({ matchedByPaymentIntent: false }), false)
  assert.equal(isOriginatingRefund({ matchedByPaymentIntent: false, invoiceBillingReason: null }), false)
})

test('only a full refund of the originating charge downgrades the listing', () => {
  assert.deepEqual(refundListingPatch({ fullyRefunded: true, isOriginatingCharge: true }), {
    tier: 'basic',
    pending_tier: null,
    pending_sponsored: null,
    is_sponsored: false,
  })
  // Renewal refund of a still-billing customer: NO downgrade.
  assert.deepEqual(refundListingPatch({ fullyRefunded: true, isOriginatingCharge: false }), {})
  // Partial refund: NO downgrade.
  assert.deepEqual(refundListingPatch({ fullyRefunded: false, isOriginatingCharge: true }), {})
  // The pending grants are ALWAYS cleared on a real downgrade — a later approval
  // must never re-grant a refunded tier.
  const patch = refundListingPatch({ fullyRefunded: true, isOriginatingCharge: true })
  assert.equal(patch.pending_tier, null)
  assert.equal(patch.pending_sponsored, null)
  assert.equal(patch.is_sponsored, false)
})

test('partial refunds are detected so commission can be flagged, not silently kept', () => {
  assert.equal(isPartialRefund({ fullyRefunded: false, amountRefunded: 500 }), true)
  assert.equal(isPartialRefund({ fullyRefunded: true, amountRefunded: 1000 }), false) // full, handled elsewhere
  assert.equal(isPartialRefund({ fullyRefunded: false, amountRefunded: 0 }), false)
})
