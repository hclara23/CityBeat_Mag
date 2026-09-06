import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMISSION_HOLD_DAYS,
  PAYOUT_POLICY_EN,
  PAYOUT_POLICY_ES,
  clawbackTransition,
  commissionDisplayState,
  commissionEligibleAt,
  commissionPayoutDate,
  isCommissionDue,
  isPayoutCycleDay,
  localDateParts,
  nextPayoutRunOn,
  partialRefundPlan,
  totalByState,
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
  // Partial refunds now shrink commission proportionally. A rep must not be
  // surprised by that, so both languages have to say it.
  assert.match(PAYOUT_POLICY_EN.clawback, /partial refund reduces it/i)
  assert.match(PAYOUT_POLICY_ES.clawback, /reembolso parcial la reduce/i)
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
    // Earned, waiting only on the rep to connect a bank. This must stay VISIBLE:
    // omitting it made a share vanish from the rep's dashboard the moment a
    // payout cycle found no connected account.
    { status: 'skipped_no_connected_account', amount: 75 },
  ]
  assert.deepEqual(totalByState(rows, now), {
    paid: 1000,
    due: 725,
    held: 300,
    owed_back: 125,
  })
  assert.deepEqual(totalByState([], now), { paid: 0, due: 0, held: 0, owed_back: 0 })
})

// ---- partial refunds --------------------------------------------------------
// A partial refund used to reduce commission by nothing at all. These pin the
// arithmetic, and above all its idempotency: Stripe fires charge.refunded for
// EVERY refund on a charge and `amount_refunded` is cumulative, so a rule that
// worked off the current share amount would compound.

test('a partial refund shrinks an unpaid share in proportion', () => {
  const plan = partialRefundPlan(
    { status: 'held', amount: 6500 },
    { amount: 10000, amount_refunded: 4000 }
  )
  assert.ok(plan)
  assert.equal(plan!.action, 'reduce')
  assert.equal(plan!.refundedRatio, 0.4)
  assert.equal(plan!.originalAmount, 6500)
  assert.equal(plan!.targetAmount, 3900) // 6500 * 60%
  assert.equal(plan!.reduceBy, 2600)
})

test('replaying the same refund event converges instead of compounding', () => {
  // First delivery: 25% refunded.
  const first = partialRefundPlan({ status: 'held', amount: 4000 }, { amount: 10000, amount_refunded: 2500 })
  assert.equal(first!.targetAmount, 3000)

  // The row after that write, then the SAME event again (Stripe retries).
  const row = { status: 'held', amount: first!.targetAmount, original_amount: first!.originalAmount }
  const replay = partialRefundPlan(row, { amount: 10000, amount_refunded: 2500 })
  assert.equal(replay!.targetAmount, 3000, 'a replay must land on the same figure')

  // A SECOND refund of another 25%: cumulative 50%, so the share is halved —
  // not 3000 * 75% = 2250, which is what compounding would produce.
  const second = partialRefundPlan(row, { amount: 10000, amount_refunded: 5000 })
  assert.equal(second!.targetAmount, 2000)
  assert.equal(second!.originalAmount, 4000)
})

test('a refund that consumes the whole charge reverses the share', () => {
  const plan = partialRefundPlan({ status: 'held', amount: 4000 }, { amount: 10000, amount_refunded: 10000 })
  assert.equal(plan!.action, 'reverse')
  assert.equal(plan!.targetAmount, 0)
})

test('an already-paid share becomes a debt, never a silent edit', () => {
  // Money has left the platform; the row must keep saying it was paid.
  const plan = partialRefundPlan({ status: 'paid', amount: 6500 }, { amount: 10000, amount_refunded: 4000 })
  assert.equal(plan!.action, 'owe')
  assert.equal(plan!.reduceBy, 2600)
})

test('a resolved or unusable share is left alone', () => {
  const charge = { amount: 10000, amount_refunded: 4000 }
  // Already reversed / already written off — idempotent no-op.
  assert.equal(partialRefundPlan({ status: 'reversed', amount: 6500 }, charge), null)
  assert.equal(partialRefundPlan({ status: 'clawback_owed', amount: 6500 }, charge), null)
  // Nothing accrued.
  assert.equal(partialRefundPlan({ status: 'held', amount: 0 }, charge), null)
  // A charge total we cannot form a ratio from must never produce a write.
  assert.equal(partialRefundPlan({ status: 'held', amount: 6500 }, { amount: 0, amount_refunded: 4000 }), null)
  assert.equal(partialRefundPlan({ status: 'held', amount: 6500 }, { amount: null, amount_refunded: 4000 }), null)
  assert.equal(partialRefundPlan({ status: 'held', amount: 6500 }, { amount: 10000, amount_refunded: 0 }), null)
  // A refund too small to move a rounded cent is not worth a write either.
  assert.equal(partialRefundPlan({ status: 'held', amount: 1 }, { amount: 100000, amount_refunded: 1 }), null)
})

test('a partial debt on a paid share shows up in the owed-back total', () => {
  // The row stays `paid` (that is what happened) with the debt recorded on it.
  const totals = totalByState([{ status: 'paid', amount: 6500, clawback_owed_amount: 2600 }])
  assert.equal(totals.paid, 6500)
  assert.equal(totals.owed_back, 2600)

  // A fully clawed-back row is counted once, by its amount — not twice.
  const full = totalByState([{ status: 'clawback_owed', amount: 6500, clawback_owed_amount: 6500 }])
  assert.equal(full.owed_back, 6500)
})

test('a debt is measured against what was PAID, not the original split', () => {
  // The sequence that exposed this: accrue $65, refund 40% while still held so
  // the share drops to $39, pay out the $39, then refund further to a cumulative
  // 60%. The share is now worth $26. Measuring the debt from the ORIGINAL $65
  // bills the rep $39 — money they never received. The true debt is $39 - $26.
  const paidAfterReduction = { status: 'paid', amount: 3900, original_amount: 6500 }
  const plan = partialRefundPlan(paidAfterReduction, { amount: 10000, amount_refunded: 6000 })
  assert.equal(plan!.action, 'owe')
  assert.equal(plan!.targetAmount, 2600)
  assert.equal(plan!.owedAmount, 1300, 'bill only what actually left the platform')

  // A share never reduced before payout: paid == original, so the debt is the
  // full reduction and the two measures agree.
  const paidInFull = { status: 'paid', amount: 6500 }
  const full = partialRefundPlan(paidInFull, { amount: 10000, amount_refunded: 6000 })
  assert.equal(full!.owedAmount, 6500 - 2600)
  assert.equal(full!.owedAmount, full!.reduceBy)
})

test('recording the same debt twice does not double it', () => {
  // clawback_owed_amount is SET, not incremented, and both inputs are stable —
  // so re-delivering the refund event lands on the same figure.
  const row = { status: 'paid', amount: 3900, original_amount: 6500 }
  const a = partialRefundPlan(row, { amount: 10000, amount_refunded: 6000 })
  const b = partialRefundPlan(row, { amount: 10000, amount_refunded: 6000 })
  assert.equal(a!.owedAmount, b!.owedAmount)
})
