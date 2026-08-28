import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIRECTORY_PLANS, FOUNDING_LIMIT, getPlan } from './pricing'
import { directoryApprovalTier, directoryClaimPendingTier } from './sales-directory'
import { countFoundingSpotsTaken } from './sales-founding'

// ---------------------------------------------------------------------------
// Pricing: the single source of truth every checkout path charges from.
// These tests pin the catalogue's structural invariants so a typo in a plan
// (a zero amount, a bad interval, a founding flag falling off) fails CI
// instead of silently mispricing a real customer.
// ---------------------------------------------------------------------------

test('every directory plan is a chargeable, coherent price', () => {
  const plans = Object.values(DIRECTORY_PLANS)
  assert.ok(plans.length >= 6)
  for (const plan of plans) {
    assert.ok(Number.isInteger(plan.unitAmount) && plan.unitAmount > 0, `${plan.id} must have a positive integer cent amount`)
    assert.ok(['month', 'year'].includes(plan.interval), `${plan.id} interval`)
    assert.ok(['premium', 'featured'].includes(plan.tier), `${plan.id} tier — 'basic' must never be sellable`)
    assert.equal(plan.id, (DIRECTORY_PLANS as any)[plan.id].id, `${plan.id} key/id agreement`)
    assert.ok(plan.priceLabel.includes('$'), `${plan.id} has a human price label`)
  }
})

test('founding plans are exactly the two launch prices, locked below standard', () => {
  const founding = Object.values(DIRECTORY_PLANS).filter((p) => p.founding)
  assert.deepEqual(founding.map((p) => p.id).sort(), ['founding', 'founding_annual'])
  // The promo's entire premise: founding is cheaper than the standard price
  // for the same tier and interval.
  assert.ok(DIRECTORY_PLANS.founding.unitAmount < DIRECTORY_PLANS.premium_monthly.unitAmount)
  assert.ok(DIRECTORY_PLANS.founding_annual.unitAmount < DIRECTORY_PLANS.premium_annual.unitAmount)
  assert.equal(FOUNDING_LIMIT, 100)
})

test('only the Sponsored plan grants the sponsored grid', () => {
  const sponsored = Object.values(DIRECTORY_PLANS).filter((p) => p.sponsored)
  assert.deepEqual(sponsored.map((p) => p.id), ['sponsored_monthly'])
  // Sponsored is the highest-priced monthly product; a cheaper plan must never
  // silently inherit the most prominent placement on the site.
  for (const plan of Object.values(DIRECTORY_PLANS)) {
    if (plan.interval === 'month' && !plan.sponsored) {
      assert.ok(plan.unitAmount <= DIRECTORY_PLANS.sponsored_monthly.unitAmount, plan.id)
    }
  }
})

test('getPlan never invents a plan', () => {
  assert.equal(getPlan(null), null)
  assert.equal(getPlan(undefined), null)
  assert.equal(getPlan(''), null)
  assert.equal(getPlan('premium_weekly'), null)
  assert.equal(getPlan('premium_monthly')?.unitAmount, 1999)
})

// ---------------------------------------------------------------------------
// Claim-tier plumbing. Regression tests for the bug where a paid net-new
// rep-sold listing was downgraded to Basic at the moment its owner's claim was
// approved: directoryClaimPendingTier read only pending_tier, which payment
// leaves null for net-new sales because the tier is granted directly.
// ---------------------------------------------------------------------------

test('a net-new paid listing (tier set, pending_tier null) keeps its paid tier through the claim flow', () => {
  assert.equal(
    directoryClaimPendingTier({ tier: 'premium', pending_tier: null, stripe_subscription_id: 'sub_1' }),
    'premium'
  )
  assert.equal(
    directoryClaimPendingTier({ tier: 'featured', pending_tier: null, stripe_subscription_id: 'sub_2' }),
    'featured'
  )
  // No live subscription -> never a paid tier, whatever the fields claim.
  assert.equal(directoryClaimPendingTier({ tier: 'premium', pending_tier: null }), 'basic')
  assert.equal(directoryClaimPendingTier({}), 'basic')
})

test('admin approval never LOWERS the tier a live subscription is paying for', () => {
  // The A1 shape: webhook granted premium at payment, pending cleared.
  assert.equal(directoryApprovalTier({ tier: 'premium', pending_tier: null, stripe_subscription_id: 's' }), 'premium')
  // Pre-existing-claim shape: pending set, tier still basic -> pending wins.
  assert.equal(directoryApprovalTier({ tier: 'basic', pending_tier: 'premium', stripe_subscription_id: 's' }), 'premium')
  // A stale LOWER pending value must not demote a live featured listing.
  assert.equal(directoryApprovalTier({ tier: 'featured', pending_tier: 'premium', stripe_subscription_id: 's' }), 'featured')
  // Cancelled/refunded (webhook reset tier to basic and cleared pending):
  // approval grants only basic — a refunded customer gets nothing paid.
  assert.equal(directoryApprovalTier({ tier: 'basic', pending_tier: null, stripe_subscription_id: 's' }), 'basic')
  // Legacy claim with no subscription keeps the historical premium fallback.
  assert.equal(directoryApprovalTier({}), 'premium')
})

// ---------------------------------------------------------------------------
// Founding 100 counter. Regression for the double-count that closed the promo
// at ~50 real members: a paid Sales Desk sale was counted once as its listing
// (founding_member set at payment) and again as a paid order awaiting its
// content brief.
// ---------------------------------------------------------------------------

test('a paid sale already represented by its listing is counted once, not twice', () => {
  const taken = countFoundingSpotsTaken(
    ['listing_a', 'listing_b'],
    [
      // The double-count shape: paid, brief not yet done, listing already flagged.
      { payment_status: 'paid', fulfillment_target: null, listing_id: 'listing_a' },
      { payment_status: 'paid', listing_id: 'listing_b' },
    ]
  )
  assert.equal(taken, 2)
})

test('a paid order with no listing yet still reserves a spot (two buyers in the same minute)', () => {
  assert.equal(
    countFoundingSpotsTaken(
      ['listing_a'],
      [{ payment_status: 'paid', listing_id: 'listing_zzz_not_flagged_yet' }]
    ),
    2
  )
  assert.equal(countFoundingSpotsTaken([], [{ payment_status: 'paid' }]), 1)
})

test('unpaid, abandoned and fulfilled orders reserve nothing extra', () => {
  assert.equal(
    countFoundingSpotsTaken(
      ['listing_a'],
      [
        { payment_status: 'pending', listing_id: 'x' }, // link never paid
        { payment_status: 'paid', fulfillment_target: { collection: 'directory_listings', id: 'listing_a' }, listing_id: 'listing_a' }, // brief done — listing carries it
      ]
    ),
    1
  )
  assert.equal(countFoundingSpotsTaken([], []), 0)
})
