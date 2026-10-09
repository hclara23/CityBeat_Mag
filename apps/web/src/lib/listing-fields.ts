// The single source of truth for directory-listing fields that must NEVER reach
// a public / unauthenticated response. Every public listing serializer imports
// this so the strip-lists can't drift apart (a divergence previously leaked the
// verification-bypass token fields and contact/stripe ids on some surfaces).

import { compEnded, compExpiryPatch } from './directory-comp'

export const PUBLIC_LISTING_STRIP_FIELDS = [
  'promotion_recipient_email',
  'promo_checkout_session_id',
  'promo_checkout_attempt',
  'promo_checkout_locale',
  'promo_checkout_expires',
  'comp_reminders_enabled',
  'email',
  'contact_email',
  'stripe_customer_id',
  'stripe_subscription_id',
  'sales_created_by',
  'sold_by_rep',
  'sales_order_id',
  'requested_product_id',
  // Salesperson verification-bypass internals — never expose the claim token
  // hash, its expiry/consumed markers, or the attestation path publicly.
  'verification_path',
  'claim_token_hash',
  'claim_token_expires_at',
  'claim_token_consumed_at',
  // Private team membership — the Firebase UIDs of invited managers (the public
  // team surface uses the owner/staff-gated managers route).
  'manager_ids',
] as const

// Mutating strip (the callers build a throwaway plain object first).
export function stripInternalListingFields<T extends Record<string, any>>(listing: T): T {
  // Enforce the exact deadline, even before the daily scheduled cleanup.
  if (compEnded(listing) && !listing.stripe_subscription_id) {
    const patch = compExpiryPatch(listing, new Date())
    if (patch.tier === 'basic') Object.assign(listing, { tier: 'basic', is_sponsored: false })
  }
  for (const field of PUBLIC_LISTING_STRIP_FIELDS) delete (listing as Record<string, any>)[field]
  return listing
}
