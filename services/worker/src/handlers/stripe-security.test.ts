import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRefundPurchaseQuery,
  isStripeTimestampFresh,
} from './stripe-security'

test('stripe webhook timestamps are accepted only inside tolerance', () => {
  assert.equal(isStripeTimestampFresh('1000', 1250, 300), true)
  assert.equal(isStripeTimestampFresh('1000', 1301, 300), false)
  assert.equal(isStripeTimestampFresh('not-a-number', 1250, 300), false)
})

test('refund lookup uses Stripe identity instead of purchase amount', () => {
  const query = buildRefundPurchaseQuery({
    id: 'ch_123',
    amount: 1900,
    payment_intent: 'pi_456',
  })

  assert.equal(query.includes('amount_total'), false)
  assert.equal(query.includes('payment_status=eq.completed'), true)
  assert.equal(query.includes('stripe_charge_id.eq.ch_123'), true)
  assert.equal(query.includes('stripe_payment_intent_id.eq.pi_456'), true)
})
