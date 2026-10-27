// Claimability, kept free of every import on purpose.
//
// These two predicates are the single source of truth for "can this listing be
// claimed", and they must be identical on the server and in the browser. They
// were not: the server-side fix landed in directory-security.ts, which reaches
// Node-only code (lib/sms.ts uses Buffer), so no client component could import
// it — and all three UI gates went on testing `claim_status === 'unclaimed'` by
// hand. The result was a paying customer, Varsity Roofing, whose claim the API
// would now accept and whose own listing page still offered them no way to
// start it.
//
// Nothing may be imported into this file. The moment it needs an import, a
// client component will stop being able to use it and the two sides will drift
// again.

/**
 * A listing whose SALE completed but whose owner was never attached.
 *
 * This state is produced by the rep-sold path and it is a trap. A rep creates
 * the listing `unclaimed` with `sold_by_rep` and `contact_email` and no
 * owner_id; the customer pays; an admin approves. The approve handler READS
 * `owner_id` and never sets it, so it stays null — and then both claim gates
 * refuse, because each only accepted `claim_status: 'unclaimed'`. The business
 * could not claim the listing it had already bought.
 *
 * Varsity Roofing is the live example: an approved, published, Founding-member
 * listing on an active subscription (sub_1U72lp…) with `owner_id: null` and
 * `ownership_verified: false`. A paying customer who cannot sign in, manage
 * their page, or see a single lead — and no self-serve route back.
 *
 * Treating it as claimable does NOT weaken verification: a claim still requires
 * a code delivered to the contact already on the business's own record. It only
 * stops an approval from permanently locking out the owner it was approved for.
 */
export function isUnownedApprovedListing(listing: {
  owner_id?: unknown
  claim_status?: unknown
}): boolean {
  const hasOwner = typeof listing.owner_id === 'string' && listing.owner_id.trim().length > 0
  return !hasOwner && listing.claim_status === 'approved'
}

/** Can a claim be started or completed for this listing? */
export function isListingClaimable(listing: { owner_id?: unknown; claim_status?: unknown }): boolean {
  return listing.claim_status === 'unclaimed' || isUnownedApprovedListing(listing)
}
