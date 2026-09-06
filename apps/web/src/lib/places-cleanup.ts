import { isGoogleMapsContent } from './scrapeflow/google-content'

// Deciding what a Google Places cleanup may touch.
//
// The sink now REFUSES new Places-derived rows (see google-content.ts), but rows
// written before that guard are still sitting in the public directory. Removing
// them is the remedy for the licence breach — and it is also, bluntly, deleting
// live business records out of a directory that a sales pipeline runs on. So the
// decision of what is untouchable is written here, as pure code with tests,
// rather than being improvised inside a script that does the deleting.
//
// PROTECTED, absolutely, whatever their provenance:
//   - anything a real person has claimed, at any stage of the claim
//   - anything with money attached
//   - a named allowlist
//
// A protected listing is left completely alone. Not stripped, not partially
// scrubbed — untouched. If a claimed listing carries Places-derived fields that
// is a separate conversation with a real owner, not something to resolve by
// quietly editing their business's public page.

/** Businesses that must never be touched, by name (case/whitespace-insensitive). */
export const PROTECTED_NAMES = ['varsity roofing']

function normalizeName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type CleanupListing = {
  id: string
  name?: unknown
  claim_status?: unknown
  owner_id?: unknown
  stripe_subscription_id?: unknown
  tier?: unknown
  pending_tier?: unknown
  sold_by_rep?: unknown
  contact_email?: unknown
  google_place_id?: unknown
  source_url?: unknown
}

export type ProtectionReason =
  | 'claimed'
  | 'has_owner'
  | 'paying'
  | 'rep_sold'
  | 'allowlisted'
  | null

/**
 * Why this listing must not be touched, or null if it is ordinary crawled
 * inventory.
 *
 * Deliberately broad. Every one of these signals means a HUMAN has a
 * relationship with this row, and the cost of a false positive is one leftover
 * directory row while the cost of a false negative is destroying a paying
 * customer's listing.
 */
export function protectionReason(listing: CleanupListing): ProtectionReason {
  if (PROTECTED_NAMES.includes(normalizeName(listing.name))) return 'allowlisted'

  // Any stage of a claim, including one still being reviewed and one that was
  // started and abandoned — someone went through the flow.
  const status = String(listing.claim_status ?? '')
  if (status && status !== 'unclaimed') return 'claimed'

  if (typeof listing.owner_id === 'string' && listing.owner_id) return 'has_owner'

  // Money attached, in either direction.
  if (typeof listing.stripe_subscription_id === 'string' && listing.stripe_subscription_id) return 'paying'
  const tier = String(listing.tier ?? '')
  const pending = String(listing.pending_tier ?? '')
  if (tier === 'premium' || tier === 'featured') return 'paying'
  if (pending === 'premium' || pending === 'featured') return 'paying'

  // A rep put their name on this and may be mid-conversation with the owner.
  if (typeof listing.sold_by_rep === 'string' && listing.sold_by_rep) return 'rep_sold'

  return null
}

export type CleanupVerdict = {
  id: string
  name: string
  googleDerived: boolean
  protection: ProtectionReason
  /** Only ever true for a Google-derived row with no protection at all. */
  removable: boolean
}

export function classifyListing(listing: CleanupListing): CleanupVerdict {
  const protection = protectionReason(listing)
  const googleDerived = isGoogleMapsContent({
    google_place_id: typeof listing.google_place_id === 'string' ? listing.google_place_id : null,
    source_url: typeof listing.source_url === 'string' ? listing.source_url : null,
  })
  return {
    id: listing.id,
    name: String(listing.name ?? listing.id),
    googleDerived,
    protection,
    // Both conditions, always. There is no path here that removes a protected row.
    removable: googleDerived && protection === null,
  }
}

export type CleanupSummary = {
  scanned: number
  googleDerived: number
  removable: number
  protectedGoogleDerived: number
  protectionBreakdown: Record<string, number>
}

export function summarize(verdicts: CleanupVerdict[]): CleanupSummary {
  const breakdown: Record<string, number> = {}
  let googleDerived = 0
  let removable = 0
  let protectedGoogleDerived = 0

  for (const v of verdicts) {
    if (v.googleDerived) googleDerived++
    if (v.removable) removable++
    if (v.googleDerived && v.protection) {
      protectedGoogleDerived++
      breakdown[v.protection] = (breakdown[v.protection] || 0) + 1
    }
  }
  return {
    scanned: verdicts.length,
    googleDerived,
    removable,
    protectedGoogleDerived,
    protectionBreakdown: breakdown,
  }
}
