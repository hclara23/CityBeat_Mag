import { hasWriterAccess, type PlatformProfile } from '@citybeat/lib/roles'
import { toE164 } from './sms'
import { isListingClaimable } from './directory-claimability'

// Re-exported so existing server-side importers keep one import site.
export { isListingClaimable, isUnownedApprovedListing } from './directory-claimability'

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

  // Decide sendability BEFORE the caller writes a claim row. Stored numbers are
  // not in the form Twilio accepts — most carry no country code, and a few are
  // mistyped past repair — so without this a listing whose number can never
  // receive a text still produced a `directory_claims` row in `code_sent` with
  // a code nobody could ever be told. The owner then sat on a verification
  // screen waiting for a message that was never dispatched.
  const sendablePhone = toE164(trustedPhone)
  if (!sendablePhone) {
    return {
      ok: false,
      statusCode: 400,
      error: 'The phone number on file for this business cannot receive text messages. Please verify by email instead, or contact us to claim this listing.',
    }
  }

  // The normalised number, so the stored claim record and the message that was
  // actually sent agree on where the code went.
  return {
    ok: true,
    status: 'code_sent',
    notificationType: 'sms',
    recipient: sendablePhone,
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
