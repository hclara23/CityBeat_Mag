import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMISSION_OWED_STATUSES,
  PAID_STATUSES,
  collectedCents,
  purchaseRowCounts,
} from './finance-rollup'

test('a subscription-backed purchase row never counts — its invoice already does', () => {
  // The double-count regression: first month of every non-directory
  // subscription landed in BOTH ad_purchases and payments.
  assert.equal(purchaseRowCounts({ stripe_subscription_id: 'sub_1' }), false)
  assert.equal(purchaseRowCounts({}), true)
  assert.equal(purchaseRowCounts({ stripe_subscription_id: null }), true)
  assert.equal(purchaseRowCounts({ stripe_subscription_id: undefined }), true)
})

test('collected cents subtract partial refunds and never go negative', () => {
  assert.equal(collectedCents({ amount: 999 }), 999)
  assert.equal(collectedCents({ amount: 5000, amount_refunded: 2000 }), 3000)
  assert.equal(collectedCents({ amount: 5000, amount_refunded: 5000 }), 0)
  // Refund larger than the amount (fees edge) clamps to zero.
  assert.equal(collectedCents({ amount: 5000, amount_refunded: 9000 }), 0)
  // Garbage never produces money.
  assert.equal(collectedCents({}), 0)
  assert.equal(collectedCents({ amount: 'x', amount_refunded: 'y' }), 0)
  assert.equal(collectedCents({ amount: -500 }), 0)
})

test('owed commission is exactly the accrued-or-attempted-but-unpaid states', () => {
  assert.deepEqual(
    [...COMMISSION_OWED_STATUSES].sort(),
    ['failed', 'held', 'skipped_no_connected_account']
  )
  // Pins that these are NOT owed: reversed (clawed back before payment),
  // clawback_owed (rep owes the platform), paid, skipped_invalid.
  for (const status of ['reversed', 'clawback_owed', 'paid', 'skipped_invalid']) {
    assert.equal((COMMISSION_OWED_STATUSES as readonly string[]).includes(status), false, status)
  }
})

test('paid statuses cover every ledger vocabulary in use', () => {
  assert.deepEqual([...PAID_STATUSES].sort(), ['completed', 'paid', 'succeeded'])
})
