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

export function directoryClaimPendingTier(
  listing: Record<string, unknown>
): 'basic' | 'premium' | 'featured' {
  const paidTier =
    listing.pending_tier === 'featured'
      ? 'featured'
      : listing.pending_tier === 'premium'
        ? 'premium'
        : null
  return listing.stripe_subscription_id && paidTier ? paidTier : 'basic'
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
    // Claims Queue's existing approve action.
    patch.claim_status = 'pending_approval'
    patch.pending_tier = pendingTier
    patch.claimed_at = now
  } else {
    // A brand-new listing the rep created for this sale — no ownership
    // dispute is possible, so the paid tier applies immediately. Stays
    // "unclaimed" per salesDirectoryClaimStatus (self-serve claimable later
    // via the verified email-code flow), independent of the tier unlock.
    patch.tier = pendingTier
    patch.pending_tier = null
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
