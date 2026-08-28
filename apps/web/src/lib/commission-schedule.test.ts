import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMISSION_HOLD_DAYS,
  clawbackTransition,
  commissionDisplayState,
  commissionEligibleAt,
  commissionPayoutDate,
  isCommissionDue,
  isPayoutCycleDay,
  localDateParts,
  nextPayoutRunOn,
  totalByState,
  PAYOUT_POLICY_EN,
  PAYOUT_POLICY_ES,
} from './commission-schedule'

test('commission matures exactly seven days after the customer pays', () => {
  assert.equal(commissionEligibleAt('2026-08-22T00:26:00.000Z'), '2026-08-29T00:26:00.000Z')
  // The hold length is configurable but defaults to the stated policy.
  assert.equal(COMMISSION_HOLD_DAYS, 7)
  assert.equal(commissionEligibleAt('2026-08-22T00:26:00.000Z', 0), '2026-08-22T00:26:00.000Z')
  assert.throws(() => commissionEligibleAt('not-a-date'), /Invalid sale date/)
})

test('payout cycle lands on the next 1st or 15th, in El Paso local time', () => {
  // Early month -> the 15th of the same month.
  assert.equal(nextPayoutRunOn('2026-08-02T12:00:00.000Z'), '2026-08-15')
  assert.equal(nextPayoutRunOn('2026-08-14T12:00:00.000Z'), '2026-08-15')
  // On a cycle day, that same day still counts (the run happens that day).
  assert.equal(nextPayoutRunOn('2026-08-15T12:00:00.000Z'), '2026-08-15')
  assert.equal(nextPayoutRunOn('2026-08-01T12:00:00.000Z'), '2026-08-01')
  // After the 15th -> the 1st of next month.
  assert.equal(nextPayoutRunOn('2026-08-16T12:00:00.000Z'), '2026-09-01')
  assert.equal(nextPayoutRunOn('2026-08-31T12:00:00.000Z'), '2026-09-01')
})

test('payout cycle rolls the year over at December', () => {
  assert.equal(nextPayoutRunOn('2026-12-20T12:00:00.000Z'), '2027-01-01')
  assert.equal(nextPayoutRunOn('2026-12-10T12:00:00.000Z'), '2026-12-15')
})

test('cycle dates are the LOCAL day, not the UTC day', () => {
  // 2026-09-01T04:00Z is still Aug 31, 6pm in El Paso (UTC-6 in summer).
  // A UTC-based implementation would wrongly call this the 1st.
  assert.deepEqual(localDateParts('2026-09-01T04:00:00.000Z'), { year: 2026, month: 8, day: 31 })
  assert.equal(isPayoutCycleDay('2026-09-01T04:00:00.000Z'), false)
  assert.equal(nextPayoutRunOn('2026-09-01T04:00:00.000Z'), '2026-09-01')
  // 12:00Z on the 1st is the 1st locally.
  assert.equal(isPayoutCycleDay('2026-09-01T12:00:00.000Z'), true)
  assert.equal(isPayoutCycleDay('2026-09-15T12:00:00.000Z'), true)
  assert.equal(isPayoutCycleDay('2026-09-16T12:00:00.000Z'), false)
})

test('end-to-end: a sale pays out on the cycle after its refund window closes', () => {
  // Bought Aug 22 -> matures Aug 29 -> next cycle is Sep 1.
  assert.equal(commissionPayoutDate('2026-08-22T00:26:00.000Z'), '2026-09-01')
  // Bought Aug 2 -> matures Aug 9 -> paid Aug 15.
  assert.equal(commissionPayoutDate('2026-08-02T00:00:00.000Z'), '2026-08-15')
  // Bought Aug 9 -> matures Aug 16 -> just misses the 15th, so Sep 1.
  assert.equal(commissionPayoutDate('2026-08-09T12:00:00.000Z'), '2026-09-01')
})

test('only held shares past their refund window are due', () => {
  const row = { status: 'held', eligible_at: '2026-08-29T00:00:00.000Z' }
  assert.equal(isCommissionDue(row, '2026-08-28T23:59:00.000Z'), false)
  assert.equal(isCommissionDue(row, '2026-08-29T00:00:00.000Z'), true)
  assert.equal(isCommissionDue(row, '2026-09-05T00:00:00.000Z'), true)
  // Anything already resolved is never re-paid.
  assert.equal(isCommissionDue({ status: 'paid', eligible_at: '2020-01-01T00:00:00.000Z' }, '2026-09-05T00:00:00.000Z'), false)
  assert.equal(isCommissionDue({ status: 'reversed', eligible_at: '2020-01-01T00:00:00.000Z' }, '2026-09-05T00:00:00.000Z'), false)
  // Malformed/missing eligibility never pays out by accident.
  assert.equal(isCommissionDue({ status: 'held' }, '2026-09-05T00:00:00.000Z'), false)
  assert.equal(isCommissionDue({ status: 'held', eligible_at: 'garbage' }, '2026-09-05T00:00:00.000Z'), false)
})

test('a refund inside the hold window costs nothing; after payment it becomes a debt', () => {
  assert.deepEqual(clawbackTransition('held'), { next: 'reversed', alreadyPaid: false })
  assert.deepEqual(clawbackTransition('failed'), { next: 'reversed', alreadyPaid: false })
  assert.deepEqual(clawbackTransition('skipped_no_connected_account'), { next: 'reversed', alreadyPaid: false })
  assert.deepEqual(clawbackTransition('paid'), { next: 'clawback_owed', alreadyPaid: true })
  // Idempotent: reversing twice does nothing the second time.
  assert.equal(clawbackTransition('reversed'), null)
  assert.equal(clawbackTransition('clawback_owed'), null)
  assert.equal(clawbackTransition(undefined), null)
})

test('a cancellation must only reverse shares still inside the refund window', () => {
  // clawbackCommission's heldOnly guard is `row.status !== 'held' || isCommissionDue(row, now)`.
  // These cases pin the predicate that drives it: everything a rep has already
  // EARNED must be excluded from a plain-cancellation reversal, even though none
  // of it has been transferred yet.
  const now = '2026-08-30T00:00:00.000Z'
  const immature = { status: 'held', eligible_at: '2026-09-10T00:00:00.000Z' }
  const matured = { status: 'held', eligible_at: '2026-08-29T00:00:00.000Z' }

  const reversibleOnCancel = (row: any) => row.status === 'held' && !isCommissionDue(row, now)

  // Backed out inside the window — reverse it, nothing was ever sent.
  assert.equal(reversibleOnCancel(immature), true)
  // Matured but waiting for the 1st/15th — EARNED, must survive.
  assert.equal(reversibleOnCancel(matured), false)
  // Transfer errored, awaiting the daily reconcile — EARNED, must survive.
  assert.equal(reversibleOnCancel({ status: 'failed', eligible_at: '2026-08-01T00:00:00.000Z' }), false)
  // Rep simply hasn't connected a bank yet — EARNED, must survive indefinitely.
  assert.equal(
    reversibleOnCancel({ status: 'skipped_no_connected_account', eligible_at: '2026-08-01T00:00:00.000Z' }),
    false
  )
  // Already transferred — untouched by a cancellation.
  assert.equal(reversibleOnCancel({ status: 'paid' }), false)
})

test('rep-facing payout terms describe what the code actually does', () => {
  // The policy promised an already-paid clawback is "deducted from your next
  // payout". Nothing implements that — runPayoutCycle reads only `held` rows and
  // never nets a `clawback_owed` debt — so the copy must not claim it.
  for (const policy of [PAYOUT_POLICY_EN, PAYOUT_POLICY_ES]) {
    assert.equal(/deducted from your next payout/i.test(policy.clawback), false)
    assert.equal(/se descuenta de tu siguiente pago/i.test(policy.clawback), false)
    assert.ok(policy.clawback.length > 40, 'the clawback term must still be stated plainly')
  }
  assert.match(PAYOUT_POLICY_EN.hold, /7 days/)
  assert.match(PAYOUT_POLICY_EN.cycle, /1st and the 15th/)
})

test('display state tells the rep exactly when money arrives', () => {
  const held = { status: 'held', eligible_at: '2026-08-29T00:00:00.000Z' }
  assert.deepEqual(commissionDisplayState(held, '2026-08-25T00:00:00.000Z'), {
    state: 'held',
    payoutDate: '2026-09-01',
  })
  assert.deepEqual(commissionDisplayState(held, '2026-08-30T00:00:00.000Z'), {
    state: 'due',
    payoutDate: '2026-09-01',
  })
  assert.deepEqual(commissionDisplayState({ status: 'paid' }, '2026-08-30T00:00:00.000Z'), {
    state: 'paid',
    payoutDate: null,
  })
  assert.deepEqual(commissionDisplayState({ status: 'clawback_owed' }), {
    state: 'clawback_owed',
    payoutDate: null,
  })
  assert.deepEqual(commissionDisplayState({ status: 'skipped_no_connected_account' }), {
    state: 'no_bank',
    payoutDate: null,
  })
  // A failed attempt still shows the cycle it will retry into.
  assert.deepEqual(
    commissionDisplayState({ status: 'failed', eligible_at: '2026-08-29T00:00:00.000Z' }, '2026-08-30T00:00:00.000Z'),
    { state: 'failed', payoutDate: '2026-09-01' }
  )
})

test('totals separate what is banked, coming, still held, and owed back', () => {
  const now = '2026-08-30T00:00:00.000Z'
  const rows = [
    { status: 'paid', amount: 1000 },
    { status: 'held', amount: 450, eligible_at: '2026-08-29T00:00:00.000Z' }, // matured -> due
    { status: 'held', amount: 300, eligible_at: '2026-09-10T00:00:00.000Z' }, // still held
    { status: 'failed', amount: 200, eligible_at: '2026-08-20T00:00:00.000Z' }, // retryable -> due
    { status: 'clawback_owed', amount: 125 },
    { status: 'reversed', amount: 999 }, // never counts toward anything
    { status: 'held', amount: 0, eligible_at: '2026-08-01T00:00:00.000Z' }, // zero ignored
  ]
  assert.deepEqual(totalByState(rows, now), {
    paid: 1000,
    due: 650,
    held: 300,
    owed_back: 125,
  })
  assert.deepEqual(totalByState([], now), { paid: 0, due: 0, held: 0, owed_back: 0 })
})
