import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PURCHASE_COLLECTED_STATUSES,
  purchaseCollectedCents,
  purchaseStatusIsCollected,
} from './purchase-revenue'

test('a partially refunded purchase still counts as revenue', () => {
  // The regression: `partially_refunded` is not one of PAID_STATUSES, so the
  // finance dashboard skipped the row entirely and a $20 goodwill refund on a
  // $500 banner removed the whole $500 from collected revenue and from that
  // month's figure. Partly refunded is not unsold.
  assert.equal(purchaseStatusIsCollected('partially_refunded'), true)
  assert.equal(purchaseStatusIsCollected('completed'), true)
  assert.equal(purchaseStatusIsCollected('paid'), true)
  assert.equal(purchaseStatusIsCollected('succeeded'), true)
})

test('a fully refunded or unpaid purchase is not revenue', () => {
  // handleChargeRefunded writes 'refunded' for a full refund — that money is
  // gone and the row must drop out, which is the one case the old status gate
  // got right.
  assert.equal(purchaseStatusIsCollected('refunded'), false)
  assert.equal(purchaseStatusIsCollected('pending'), false)
  assert.equal(purchaseStatusIsCollected(''), false)
  assert.equal(purchaseStatusIsCollected(undefined), false)
  assert.equal(purchaseStatusIsCollected(null), false)
})

test('collected cents subtract a recorded refund and never invent money', () => {
  assert.equal(purchaseCollectedCents({ amount_total: 50000 }), 50000)
  assert.equal(purchaseCollectedCents({ amount_total: 50000, amount_refunded: 2000 }), 48000)
  // sales_orders records the refund as `refund_amount`; accept either spelling
  // rather than counting a known refund as zero.
  assert.equal(purchaseCollectedCents({ amount_total: 50000, refund_amount: 2000 }), 48000)
  // A refund larger than the sale (fees edge) clamps to zero, never negative.
  assert.equal(purchaseCollectedCents({ amount_total: 50000, amount_refunded: 90000 }), 0)
  // Garbage never produces money.
  assert.equal(purchaseCollectedCents({}), 0)
  assert.equal(purchaseCollectedCents({ amount_total: 'x', amount_refunded: 'y' }), 0)
  assert.equal(purchaseCollectedCents({ amount_total: -500 }), 0)
})

test('the collected-status list stays a superset of the paid statuses', () => {
  // Pins the shape the finance route relies on: everything PAID_STATUSES calls
  // collected is still collected here, plus the partial-refund state.
  assert.deepEqual(
    [...PURCHASE_COLLECTED_STATUSES].sort(),
    ['completed', 'paid', 'partially_refunded', 'succeeded']
  )
})
