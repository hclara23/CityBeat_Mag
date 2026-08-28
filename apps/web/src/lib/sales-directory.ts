import type { SalesProductId } from './sales-products'

export function buildSalesDirectoryListingRecord(input: {
  businessName: string
  category: string
  contactEmail: string
  contactPhone?: string
  locale: 'en' | 'es'
  sellerUserId: string
  productId: SalesProductId
  orderId?: string
  now?: Date
}) {
  const now = (input.now || new Date()).toISOString()
  return {
    name: input.businessName,
    category: input.category,
    email: input.contactEmail,
    contact_email: input.contactEmail,
    phone: input.contactPhone || null,
    tier: 'basic',
    plan: input.productId === 'directory_basic_free' ? 'basic' : null,
    requested_product_id: input.productId,
    owner_id: null,
    claim_status: 'unclaimed',
    ownership_verified: false,
    is_published: true,
    is_sponsored: false,
    source: 'sales_rep',
    sold_by_rep: input.sellerUserId,
    sales_created_by: input.sellerUserId,
    sales_order_id: input.orderId || null,
    locale: input.locale,
    created_at: now,
    updated_at: now,
  }
}

export function salesDirectoryListingUrl(input: {
  origin: string
  locale: 'en' | 'es'
  listingId: string
}) {
  const url = new URL(input.origin)
  url.pathname = `/${input.locale}/directory/${encodeURIComponent(input.listingId)}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function salesDirectoryClaimStatus(input: {
  ownerId?: unknown
  soldBy?: unknown
  listingPreexisting?: unknown
}): 'unclaimed' | 'pending_approval' {
  const repCreatedNewListing =
    Boolean(input.soldBy) &&
    !input.ownerId &&
    (input.listingPreexisting === false || input.listingPreexisting === 'false')
  return repCreatedNewListing ? 'unclaimed' : 'pending_approval'
}

export function isSalesCreatedDirectoryListing(listing: Record<string, unknown>) {
  return (
    listing.source === 'sales_rep' ||
    Boolean(listing.sales_created_by) ||
    Boolean(listing.sold_by_rep) ||
    Boolean(listing.sales_order_id)
  )
}

export function salesDirectoryCheckoutIsManaged(listing: Record<string, unknown>) {
  if (!isSalesCreatedDirectoryListing(listing)) return false
  const approvedFreeListing =
    listing.requested_product_id === 'directory_basic_free' &&
    listing.claim_status === 'approved' &&
    !listing.stripe_subscription_id
  return !approvedFreeListing
}

/**
 * The tier a verified claim should carry into the admin approval queue.
 *
 * Reads the tier that was actually GRANTED, which lives in `pending_tier` for a
 * claim on a pre-existing listing but in `tier` for a net-new rep sale — where
 * payment unlocks the tier immediately and leaves `pending_tier` null (see
 * directoryOrderPaymentPatch). Reading only `pending_tier` returned 'basic' for
 * every paid net-new listing, and since the approval route resolves
 * `pending_tier || tier`, that truthy 'basic' then WON — silently downgrading a
 * paying customer at the exact moment an admin approved their ownership claim.
 */
export function directoryClaimPendingTier(
  listing: Record<string, unknown>
): 'basic' | 'premium' | 'featured' {
  const granted = listing.pending_tier ?? listing.tier
  const paidTier = granted === 'featured' ? 'featured' : granted === 'premium' ? 'premium' : null
  return listing.stripe_subscription_id && paidTier ? paidTier : 'basic'
}

// Rank for "never downgrade an actively-paying listing" comparisons.
const TIER_RANK: Record<string, number> = { basic: 1, premium: 2, featured: 3 }

/**
 * The tier an admin approval should grant. Approval must never LOWER the tier a
 * live subscription is already paying for — it is an ownership decision, not a
 * billing one. A cancelled subscription already resets `tier` to basic in the
 * webhook, so taking the higher of the two cannot strand a stale paid tier.
 */
export function directoryApprovalTier(listing: Record<string, unknown>): string {
  const pending = typeof listing.pending_tier === 'string' ? listing.pending_tier : ''
  const current = typeof listing.tier === 'string' ? listing.tier : ''
  const resolved = pending || current || 'premium'
  if (!listing.stripe_subscription_id) return resolved
  return (TIER_RANK[current] || 0) > (TIER_RANK[resolved] || 0) ? current : resolved
}

/**
 * Tier/claim-status/Stripe-linkage patch for a Sales Desk directory order at
 * checkout.session.completed — independent of whether the customer has
 * finished their /fulfill/{orderId} content brief. Payment is the trust
 * signal for tier eligibility and Stripe linkage; the brief is separately
 * about listing CONTENT (description/photos), so one must not gate the other
 * — a customer who pays but stalls on (or simply hasn't yet reached) the
 * brief must still get the tier they paid for and a findable subscription
 * link, or a later renewal/cancellation/refund webhook has no way to locate
 * their listing.
 */
export function directoryOrderPaymentPatch(input: {
  metadata: Record<string, any>
  order: Record<string, any>
  currentListing: Record<string, any>
  subscriptionId: string | null
  customerId: string | null
  now?: Date
}): Record<string, any> {
  const now = (input.now || new Date()).toISOString()
  const pendingTier = input.metadata.tier === 'featured' ? 'featured' : 'premium'
  const effectiveOwnerId = input.currentListing.owner_id || null
  const claimStatus = salesDirectoryClaimStatus({
    ownerId: effectiveOwnerId,
    soldBy: input.metadata.sold_by,
    listingPreexisting: input.order.listing_preexisting,
  })
  const sponsored = input.metadata.sponsored === 'true' || Boolean(input.order.sponsored)
  const patch: Record<string, any> = {
    plan: input.metadata.plan || input.order.directory_plan_id || 'premium_monthly',
    founding_member: input.metadata.founding === 'true' || Boolean(input.order.founding),
    stripe_subscription_id: input.subscriptionId,
    stripe_customer_id: input.customerId,
    updated_at: now,
  }
  if (claimStatus === 'pending_approval') {
    // Claiming a pre-existing listing (fraud-review risk) → queue for admin
    // approval; tier stays basic until they promote pending_tier via the
    // Claims Queue's existing approve action. Sponsored placement is the
    // MOST visible perk on the site, so it gets the same fraud gate as tier
    // — a paid claim on someone else's real business must not light up the
    // directory homepage before an admin has confirmed it.
    patch.claim_status = 'pending_approval'
    patch.pending_tier = pendingTier
    patch.pending_sponsored = sponsored
    patch.claimed_at = now
  } else {
    // A brand-new listing the rep created for this sale — no ownership
    // dispute is possible, so the paid tier (and sponsored placement, if
    // purchased) applies immediately. Stays "unclaimed" per
    // salesDirectoryClaimStatus (self-serve claimable later via the verified
    // email-code flow), independent of the tier/sponsorship unlock.
    patch.tier = pendingTier
    patch.pending_tier = null
    if (sponsored) {
      patch.is_sponsored = true
      patch.sponsored_since = now
    }
  }
  return patch
}

export function salesDirectoryHandoffMatches(input: {
  listing: Record<string, unknown>
  listingId: string
  sellerUserId: string
  listingUrl: string
  requestOrigin: string
  locale: 'en' | 'es'
}) {
  if (
    input.listing.sales_created_by !== input.sellerUserId &&
    input.listing.sold_by_rep !== input.sellerUserId
  ) {
    return false
  }
  try {
    const actual = new URL(input.listingUrl)
    const expected = new URL(
      salesDirectoryListingUrl({
        origin: input.requestOrigin,
        locale: input.locale,
        listingId: input.listingId,
      })
    )
    return actual.origin === expected.origin && actual.pathname === expected.pathname
  } catch {
    return false
  }
}
