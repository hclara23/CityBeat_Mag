import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutAttemptDocumentId, checkoutRenewalError, isStripeResourceMissing, oldCheckoutRetirementState, replacementCompensationOutcome } from './sales-resilience'

test('checkout attempts are stable per seller and key but isolated between sellers', () => {
  const key = '9bf1cd96-21df-4654-b293-f257c5c12afd'
  assert.equal(checkoutAttemptDocumentId('seller-a', key), checkoutAttemptDocumentId('seller-a', key))
  assert.notEqual(checkoutAttemptDocumentId('seller-a', key), checkoutAttemptDocumentId('seller-b', key))
  assert.equal(checkoutAttemptDocumentId('seller-a', 'short'), null)
})

test('only an expired unpaid checkout owned by the seller can be renewed', () => {
  const now = new Date('2026-10-15T19:00:00Z')
  const expired = { sold_by: 'seller-a', payment_status: 'pending', checkout_status: 'ready', checkout_url: 'https://checkout.stripe.com/c/pay/test', checkout_expires_at: '2026-10-15T18:00:00Z' }
  assert.equal(checkoutRenewalError(expired, 'seller-a', now), null)
  assert.equal(checkoutRenewalError(expired, 'seller-b', now), 'renewal_forbidden')
  assert.equal(checkoutRenewalError({ ...expired, payment_status: 'paid' }, 'seller-a', now), 'order_paid')
  assert.equal(checkoutRenewalError({ ...expired, checkout_expires_at: '2026-10-15T20:00:00Z' }, 'seller-a', now), 'checkout_still_live')
})

test('replacement cleanup ignores only Stripe resource_missing responses', () => {
  assert.equal(isStripeResourceMissing({ code: 'resource_missing' }), true)
  assert.equal(isStripeResourceMissing({ raw: { code: 'resource_missing' } }), true)
  assert.equal(isStripeResourceMissing({ code: 'api_connection_error' }), false)
  assert.equal(isStripeResourceMissing(new Error('timeout')), false)
})

test('replacement compensation leaves no shareable replacement and escalates cleanup failure', () => {
  assert.deepEqual(replacementCompensationOutcome(null), {
    auditStatus: 'new_session_expired_after_old_expiry_failure',
    orderStatus: 'failed',
    errorCode: 'replacement_old_expiry_failed',
  })
  assert.deepEqual(replacementCompensationOutcome(new Error('Stripe unavailable')), {
    auditStatus: 'compensation_failed',
    orderStatus: 'needs_attention',
    errorCode: 'replacement_compensation_failed',
  })
})

test('replacement retries distinguish retired sessions from completed payments', () => {
  assert.equal(oldCheckoutRetirementState({ status: 'expired', payment_status: 'unpaid' }), 'retired')
  assert.equal(oldCheckoutRetirementState({ status: 'complete', payment_status: 'unpaid' }), 'completed')
  assert.equal(oldCheckoutRetirementState({ status: 'open', payment_status: 'paid' }), 'completed')
  assert.equal(oldCheckoutRetirementState({ status: 'open', payment_status: 'unpaid' }), 'open')
  assert.equal(oldCheckoutRetirementState({ status: 'weird' }), 'unknown')
})
