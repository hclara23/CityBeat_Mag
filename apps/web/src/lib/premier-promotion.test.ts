import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessPremierOffer, premierGrant, premierOfferOpen, premierExpiryExtras, PREMIER_MONTHLY_CENTS, promotionDaysLeft, premierPaymentConfirmed } from './premier-promotion'
import { compExpiryPatch } from './directory-comp'
import { resolveEntitlements, filterEntitledListingUpdate, resolveListingPatchAccess } from './directory-entitlements'
import { stripInternalListingFields } from './listing-fields'

const now = new Date('2026-10-09T01:00:00Z')
const listing = { id: 'premier-clinic', ...premierGrant(now), promotion_recipient_email: 'doctor@example.com', location_count: 3 }
test('dashboard countdown is live, rounds partial days up, and never goes negative', () => {
  assert.equal(promotionDaysLeft(listing.comp_until, now.getTime()), 30)
  assert.equal(promotionDaysLeft(listing.comp_until, now.getTime() + 86400000), 29)
  assert.equal(promotionDaysLeft(listing.comp_until, Date.parse(listing.comp_until) - 1), 1)
  assert.equal(promotionDaysLeft(listing.comp_until, Date.parse(listing.comp_until)), 0)
  assert.equal(promotionDaysLeft('invalid', now.getTime()), 0)
})
test('Premier activation requires a confirmed $9.99 USD subscription payment', () => {
  const paid = { metadata: { promo_id: 'premier_cover_30day', listing_id: 'premier-clinic' }, mode: 'subscription', payment_status: 'paid', amount_total: 999, currency: 'usd', subscription: 'sub_expected' }
  assert.equal(premierPaymentConfirmed(paid), true)
  for (const patch of [{ payment_status: 'unpaid' }, { amount_total: 2997 }, { currency: 'mxn' }, { subscription: null }, { metadata: {} }]) {
    assert.equal(premierPaymentConfirmed({ ...paid, ...patch }), false)
  }
})
test('Premier receives exactly 30 days, not a calendar month; total price is 999 cents', () => {
  assert.equal(Date.parse(listing.comp_until) - now.getTime(), 30 * 86400000)
  assert.equal(PREMIER_MONTHLY_CENTS, 999)
  assert.equal(premierOfferOpen(listing, Date.parse(listing.comp_until) - 1), true)
  assert.equal(premierOfferOpen(listing, Date.parse(listing.comp_until)), false)
})
test('private promotion requires verified invited email and cannot displace an owner', () => {
  const user = { id: 'doctor', email: 'Doctor@Example.com', email_verified: true }
  assert.equal(canAccessPremierOffer(listing, user), true)
  assert.equal(canAccessPremierOffer(listing, { ...user, email_verified: false }), false)
  assert.equal(canAccessPremierOffer(listing, { ...user, email: 'other@example.com' }), false)
  assert.equal(canAccessPremierOffer({ ...listing, owner_id: 'other' }, user), false)
  assert.equal(canAccessPremierOffer({ ...listing, id: 'another-business' }, user), false)
})
test('expired grant preserves basic ownership, photos and cover evidence but removes sponsored placement', () => {
  const owned = { ...listing, owner_id: 'doctor', claim_status: 'approved', print_recognition: [{ type: 'cover' }], gallery_urls: ['stored.webp'] }
  const expired = { ...owned, ...compExpiryPatch(owned, new Date(listing.comp_until)), ...premierExpiryExtras(owned) }
  assert.equal(expired.tier, 'basic')
  assert.equal(expired.owner_id, 'doctor')
  assert.deepEqual(expired.print_recognition, owned.print_recognition)
  assert.deepEqual(expired.gallery_urls, owned.gallery_urls)
  assert.equal(expired.is_sponsored, false)
  assert.equal(resolveListingPatchAccess(expired, { userId: 'doctor' }).canManage, true)
  assert.equal(resolveEntitlements(owned, new Date(listing.comp_until)).enhancedDescription, false)
})
test('owners cannot extend or award the private promotion and public responses hide recipient/checkout state', () => {
  const raw = { ...listing, promo_checkout_session_id: 'cs_private', promo_checkout_attempt: 'secret', comp_reminders_enabled: true }
  assert.deepEqual(filterEntitledListingUpdate(raw, { entitlements: resolveEntitlements({ tier: 'premium' }) }).updates, {})
  const safe = stripInternalListingFields({ ...raw })
  assert.equal('promotion_recipient_email' in safe, false)
  assert.equal('promo_checkout_session_id' in safe, false)
  assert.equal('promo_checkout_attempt' in safe, false)
})
