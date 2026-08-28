import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderStatusHeadline, orderStatusSteps } from './order-status'

const states = (o: any) => orderStatusSteps(o).map((s) => `${s.key}:${s.state}`)

test('an unpaid order shows payment as the current step', () => {
  assert.deepEqual(states({ payment_status: 'pending' }), [
    'paid:current',
    'brief:upcoming',
    'review:upcoming',
    'live:upcoming',
  ])
  assert.match(orderStatusHeadline({ payment_status: 'pending' }, 'en'), /Waiting for payment/)
})

test('paid but no brief yet points the customer at their details', () => {
  const o = { payment_status: 'paid', intake_status: 'not_started', fulfillment_status: 'awaiting_intake' }
  assert.deepEqual(states(o), ['paid:done', 'brief:current', 'review:upcoming', 'live:upcoming'])
  assert.match(orderStatusHeadline(o, 'en'), /Finish your order details/)
  assert.match(orderStatusHeadline(o, 'es'), /Completa/)
})

test('brief submitted, in review', () => {
  const o = { payment_status: 'paid', intake_status: 'submitted', fulfillment_status: 'in_review' }
  assert.deepEqual(states(o), ['paid:done', 'brief:done', 'review:current', 'live:upcoming'])
  assert.match(orderStatusHeadline(o, 'en'), /In review/)
})

test('live order marks everything done', () => {
  const o = { payment_status: 'paid', intake_status: 'submitted', fulfillment_status: 'fulfilled' }
  assert.deepEqual(states(o), ['paid:done', 'brief:done', 'review:done', 'live:done'])
  assert.match(orderStatusHeadline(o, 'en'), /You're live/)
  // A directory listing that goes live is 'listing_live'.
  assert.match(orderStatusHeadline({ ...o, fulfillment_status: 'listing_live' }, 'en'), /live/)
})

test('needs_attention is surfaced honestly, not hidden', () => {
  const o = { payment_status: 'paid', intake_status: 'submitted', fulfillment_status: 'needs_attention' }
  assert.match(orderStatusHeadline(o, 'en'), /need to review/)
  assert.match(orderStatusHeadline(o, 'es'), /revisar/)
})
