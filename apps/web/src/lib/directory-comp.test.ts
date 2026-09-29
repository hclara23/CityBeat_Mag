import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WARM_LEADS_PROMO,
  activeCompTier,
  addMonths,
  compEnded,
  compExpiryPatch,
  compGrantPatch,
  needsCompReminder,
} from './directory-comp'
import { resolveEntitlements } from './directory-entitlements'
import { directoryApprovalTier, directoryClaimPendingTier } from './sales-directory'

const NOW = new Date('2026-09-30T12:00:00Z')
const granted = (): Record<string, unknown> => ({ tier: 'basic', ...compGrantPatch(NOW) })

test('the promotion is three months of Premium', () => {
  assert.equal(WARM_LEADS_PROMO.tier, 'premium')
  assert.equal(WARM_LEADS_PROMO.months, 3)
  const g = granted()
  assert.equal(g.tier, 'premium')
  assert.equal(g.comp_until, '2026-12-30T12:00:00.000Z')
})

test('addMonths clamps to the last day of a shorter month', () => {
  assert.equal(addMonths(new Date('2026-11-30T00:00:00Z'), 3).toISOString(), '2027-02-28T00:00:00.000Z')
  assert.equal(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString(), '2026-02-28T00:00:00.000Z')
})

test('a comp is active until its end date, then ended', () => {
  const g = granted()
  assert.equal(activeCompTier(g, NOW), 'premium')
  assert.equal(activeCompTier(g, new Date('2026-12-30T11:59:59Z')), 'premium')
  assert.equal(activeCompTier(g, new Date('2026-12-30T12:00:00Z')), null)
  assert.equal(compEnded(g, new Date('2026-12-31T00:00:00Z')), true)
  assert.equal(compEnded({ tier: 'premium' }, NOW), false, 'a listing with no comp never "ends"')
})

test('an unreadable end date is never honoured as an open-ended grant', () => {
  const bad = { tier: 'premium', comp_tier: 'premium', comp_until: 'someday' }
  assert.equal(activeCompTier(bad, NOW), null)
  assert.equal(compEnded(bad, NOW), true)
})

test('expiry returns an unpaid listing to Basic', () => {
  const patch = compExpiryPatch(granted(), new Date('2027-01-01T00:00:00Z'))
  assert.equal(patch.tier, 'basic')
  assert.equal(patch.comp_tier, null)
})

test('expiry never downgrades a listing that started paying', () => {
  const paying = { ...granted(), stripe_subscription_id: 'sub_123' }
  const patch = compExpiryPatch(paying, new Date('2027-01-01T00:00:00Z'))
  assert.equal('tier' in patch, false)
  assert.equal(patch.comp_tier, null)
})

test('expiry never lowers a tier the comp did not set', () => {
  const handSet = { ...granted(), tier: 'featured' }
  assert.equal('tier' in compExpiryPatch(handSet, new Date('2027-01-01T00:00:00Z')), false)
})

test('the reminder goes once, in the last 15 days, and never to a payer', () => {
  const g = granted()
  assert.equal(needsCompReminder(g, NOW), false, 'too early')
  const late = new Date('2026-12-20T12:00:00Z')
  assert.equal(needsCompReminder(g, late), true)
  assert.equal(needsCompReminder({ ...g, comp_reminder_sent_at: '2026-12-16T00:00:00Z' }, late), false)
  assert.equal(needsCompReminder({ ...g, stripe_subscription_id: 'sub_1' }, late), false)
  assert.equal(needsCompReminder(g, new Date('2027-01-02T00:00:00Z')), false, 'already over')
})

test('claiming a comped listing keeps the free Premium through approval', () => {
  // The claim itself is a free Basic claim (nothing is paid)...
  const claimed = { ...granted(), pending_tier: directoryClaimPendingTier(granted()) }
  assert.equal(claimed.pending_tier, 'basic')
  // ...but approval must not drop the comp.
  assert.equal(directoryApprovalTier(claimed, NOW), 'premium')
})

test('approval after the comp ended grants what was claimed', () => {
  const claimed = { ...granted(), pending_tier: 'basic' }
  assert.equal(directoryApprovalTier(claimed, new Date('2027-01-05T00:00:00Z')), 'basic')
})

test('entitlements fall back to Basic the moment a comp ends, even before the cron runs', () => {
  const g = granted()
  assert.equal(resolveEntitlements(g as any), resolveEntitlements({ tier: 'premium' }))
  const lapsed = resolveEntitlements(g as any, new Date('2027-01-01T00:00:00Z'))
  assert.equal(lapsed, resolveEntitlements({ tier: 'basic' }))
  // A payer is unaffected by an old comp record.
  const paid = resolveEntitlements({ ...g, stripe_subscription_id: 'sub_1' } as any, new Date('2027-01-01T00:00:00Z'))
  assert.equal(paid, resolveEntitlements({ tier: 'premium' }))
})
