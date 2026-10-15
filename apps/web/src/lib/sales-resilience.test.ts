import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutAttemptDocumentId, checkoutRenewalError } from './sales-resilience'

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
