import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mayCreateTransfer } from './payouts'

// These pin the double-pay regression in executeTransfer: the prior-transfer
// lookup used to swallow its own error into `adopted = null`, which made "Stripe
// errored" look exactly like "Stripe has no transfer for this share".

test('a prior transfer found on Stripe is adopted, never re-created', () => {
  assert.equal(mayCreateTransfer('found'), false)
})

test('an errored prior-transfer lookup blocks the create — silence is not proof of absence', () => {
  // A share whose transfer succeeded but whose ledger write failed stays `held`
  // and gets re-selected by a later payout cycle. The stable Stripe idempotency
  // key has expired by then (~24h), so this lookup is the only guard left:
  // creating on an inconclusive answer pays the rep twice for one sale, while
  // refusing costs at most a delayed payout that the next run retries.
  assert.equal(mayCreateTransfer('failed'), false)
})

test('only a conclusive answer permits creating a transfer', () => {
  assert.equal(mayCreateTransfer('none'), true)
  // A share with no stable key has no transfer_group to look up by. That path
  // never had this backstop and must not be blocked by adding one.
  assert.equal(mayCreateTransfer('unchecked'), true)
})
