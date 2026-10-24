import { hasWriterAccess, type PlatformProfile } from '@citybeat/lib/roles'

export const MAX_CREATOR_UPLOAD_BYTES = 8 * 1024 * 1024

const CREATOR_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

type UploadFileLike = {
  type: string
  size: number
}

type ClaimMethod = 'email' | 'phone' | 'postcard'

type ClaimListing = {
  name: string
  claim_status: string
  phone?: string | null
  email?: string | null
  /** Rep-sold and scraped rows carry the address here rather than in `email`.
   *  The claim hint already masks `email || contact_email`, so omitting it from
   *  this type is what let the verifier refuse an address the owner was shown. */
  contact_email?: string | null
}

type ClaimVerificationInput = {
  method: ClaimMethod
  requestedContact?: string | null
  listing: ClaimListing
}

type ClaimVerificationResult =
  | {
      ok: true
      status: 'code_sent' | 'pending'
      notificationType: 'sms' | 'email' | 'postcard'
      recipient: string | null
    }
  | {
      ok: false
      statusCode: 400
      error: string
    }

export function canUploadCreatorMedia(profile: PlatformProfile | null | undefined) {
  return hasWriterAccess(profile)
}

export function validateCreatorUploadFile(file: UploadFileLike) {
  if (!CREATOR_UPLOAD_TYPES.has(file.type)) {
    return { ok: false as const, error: 'Invalid file type.' }
  }

  if (file.size > MAX_CREATOR_UPLOAD_BYTES) {
    return { ok: false as const, error: 'Image must be 8MB or smaller.' }
  }

  return { ok: true as const }
}

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

export function resolveClaimVerification({
  method,
  listing,
}: ClaimVerificationInput): ClaimVerificationResult {
  if (!isListingClaimable(listing)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Listing is already claimed or claim is pending',
    }
  }

  if (method === 'postcard') {
    return {
      ok: true,
      status: 'pending',
      notificationType: 'postcard',
      recipient: null,
    }
  }

  if (method === 'email') {
    // Same precedence the claim hint and the unclaimed relay use
    // (api/directory/[id]/route.ts maskClaimContact reads
    // `data.email || data.contact_email`). Reading only `email` here showed an
    // owner a masked address and then refused to send a code to it.
    const trustedEmail = (listing.email || listing.contact_email)?.trim()
    if (!trustedEmail) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Email verification is unavailable for this listing.',
      }
    }
    return {
      ok: true,
      status: 'code_sent',
      notificationType: 'email',
      recipient: trustedEmail,
    }
  }

  const trustedPhone = listing.phone?.trim()
  if (!trustedPhone) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Phone verification is unavailable for this listing.',
    }
  }

  return {
    ok: true,
    status: 'code_sent',
    notificationType: 'sms',
    recipient: trustedPhone,
  }
}

export function sanitizePublicReview<T extends { profiles?: Record<string, unknown> | null }>(
  review: T
) {
  if (!review.profiles) return review

  const { full_name, avatar_url } = review.profiles
  return {
    ...review,
    profiles: {
      full_name,
      avatar_url,
    },
  }
}

export function shouldAwardReviewPoints(params: {
  isAdvertiser: boolean
  hasExistingReview: boolean
}) {
  return !params.isAdvertiser && !params.hasExistingReview
}
