import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REFERRAL_MONTHLY_COUPON_ID,
  addCalendarMonths,
  annualCouponId,
  annualDiscountPercent,
  decideReferralQualification,
  normalizeReferralCode,
  referralCodeForListing,
  referralCouponFromInvoice,
  referralDiscountAmount,
} from './referrals'

test('listing referral codes are stable, normalized, and non-guessable from display names', () => {
  const code = referralCodeForListing('listing-123')
  assert.match(code, /^[A-F0-9]{12}$/)
  assert.equal(referralCodeForListing('listing-123'), code)
  assert.equal(normalizeReferralCode(code.toLowerCase()), code)
  assert.equal(normalizeReferralCode('not-a-code'), null)
})

test('three-month eligibility uses calendar months without end-of-month overflow', () => {
  assert.equal(
    addCalendarMonths('2026-01-31T18:30:00.000Z', 3).toISOString(),
    '2026-04-30T18:30:00.000Z'
  )
  assert.equal(
    addCalendarMonths('2026-11-30T08:00:00.000Z', 3).toISOString(),
    '2027-02-28T08:00:00.000Z'
  )
})

test('annual rewards preserve the value of three monthly 25% discounts', () => {
  assert.equal(annualDiscountPercent(3), 6.25)
  assert.equal(annualDiscountPercent(6), 12.5)
  assert.equal(annualDiscountPercent(48), 100)
  assert.equal(annualDiscountPercent(60), 100)
  assert.equal(annualCouponId(3), 'citybeat_referral_annual_03')
})

test('qualification waits three months and requires an active paid subscription', () => {
  const base = {
    eligibleAt: '2026-10-21T12:00:00.000Z',
    qualifiedCount: 0,
  }
  assert.deepEqual(
    decideReferralQualification({
      ...base,
      now: '2026-10-20T12:00:00.000Z',
      subscriptionStatus: 'active',
    }),
    { action: 'wait', reason: 'not_due' }
  )
  assert.deepEqual(
    decideReferralQualification({
      ...base,
      now: '2026-10-21T12:00:00.000Z',
      subscriptionStatus: 'past_due',
    }),
    { action: 'wait', reason: 'past_due' }
  )
  assert.deepEqual(
    decideReferralQualification({
      ...base,
      now: '2026-10-21T12:00:00.000Z',
      subscriptionStatus: 'canceled',
    }),
    { action: 'disqualify', reason: 'canceled' }
  )
})

test('qualification enforces the 16-referral calendar-year cap', () => {
  assert.deepEqual(
    decideReferralQualification({
      eligibleAt: '2026-10-21T12:00:00.000Z',
      now: '2026-10-21T12:00:00.000Z',
      subscriptionStatus: 'active',
      qualifiedCount: 16,
    }),
    { action: 'cap', reason: 'annual_cap' }
  )

  assert.deepEqual(
    decideReferralQualification({
      eligibleAt: '2026-10-21T12:00:00.000Z',
      now: '2026-10-21T12:00:00.000Z',
      subscriptionStatus: 'active',
      qualifiedCount: 15,
    }),
    { action: 'qualify', qualificationYear: 2026 }
  )
})

test('invoice helpers identify referral discounts and their exact reward usage', () => {
  const invoice = {
    discount: {
      coupon: {
        id: REFERRAL_MONTHLY_COUPON_ID,
        metadata: { citybeat_referral: 'true', reward_mode: 'month', reward_months: '1' },
      },
    },
    total_discount_amounts: [{ amount: 500 }],
  }

  assert.deepEqual(referralCouponFromInvoice(invoice), {
    id: REFERRAL_MONTHLY_COUPON_ID,
    rewardMonths: 1,
    mode: 'month',
  })
  assert.equal(referralDiscountAmount(invoice), 500)
  assert.equal(referralCouponFromInvoice({ discount: null }), null)
})
