import { NextRequest, NextResponse } from 'next/server'
import { isUnownedApprovedListing } from '@/lib/directory-security'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { directoryClaimPendingTier } from '@/lib/sales-directory'

export const dynamic = 'force-dynamic'

function createdMs(v: any): number {
  if (v?.toDate) return v.toDate().getTime()
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id: listingId } = params
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in to verify your claim.' }, { status: 401 })
  }

  try {
    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Missing verification code' }, { status: 400 })
    }

    // Find the latest code_sent claim for this user/listing (sorted in memory to avoid composite index).
    const snap = await adminDb
      .collection('directory_claims')
      .where('listing_id', '==', listingId)
      .where('user_id', '==', user.id)
      .where('status', '==', 'code_sent')
      .get()

    if (snap.empty) {
      return NextResponse.json({ error: 'No active claim request found for this listing' }, { status: 404 })
    }

    const claimDoc = snap.docs.sort(
      (a, b) => createdMs((b.data() as any).created_at) - createdMs((a.data() as any).created_at)
    )[0]
    const listingRef = adminDb.collection('directory_listings').doc(listingId)
    const result = await adminDb.runTransaction(async tx => {
    // Reread both documents before writes: concurrent verification must never
    // overwrite another claimant or reset an already approved owner to pending.
    const [freshClaim, listingDoc] = await Promise.all([tx.get(claimDoc.ref), tx.get(listingRef)])
    const claim = freshClaim.data() as any
    if (!claim || claim.status !== 'code_sent' || claim.user_id !== user.id || claim.listing_id !== listingId) {
      return { status: 409, body: { error: 'This claim is no longer active. Request a new code.' } }
    }
    if (!listingDoc.exists) return { status: 404, body: { error: 'Listing not found' } }
    const listing = listingDoc.data() as Record<string, unknown>
    // `approved` with no owner is the rep-sold trap: the sale completed, nobody
    // attached an account, and both gates then refused — locking the paying
    // business out of the listing it had bought. See isUnownedApprovedListing.
    const reattachingOwner = isUnownedApprovedListing(listing)
    if (
      !reattachingOwner &&
      (listing.owner_id ||
        (listing.claim_status && listing.claim_status !== 'unclaimed' && listing.claim_status !== 'rejected'))
    ) {
      return { status: 409, body: { error: 'This listing already has an owner or a pending claim.' } }
    }
    const now = new Date().toISOString()
    const MAX_ATTEMPTS = 5

    // Reject expired codes (15-minute TTL set when the code was issued).
    if (!Number.isFinite(Number(claim.expires_at)) || Date.now() >= Number(claim.expires_at)) {
      tx.set(claimDoc.ref, { status: 'expired', updated_at: now }, { merge: true })
      return { status: 400, body: { error: 'This verification code has expired. Please request a new one.' } }
    }
    if (Number(claim.attempts || 0) >= MAX_ATTEMPTS) return { status: 429, body: { error: 'Please request a new code.' } }
    if (claim.verification_code !== String(code).trim()) {
      const attempts = Number(claim.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        // Too many wrong guesses — invalidate the code so it must be re-requested.
        tx.set(claimDoc.ref, { status: 'failed', attempts, updated_at: now }, { merge: true })
        return { status: 429, body: { error: 'Too many incorrect attempts. Please request a new code.' } }
      }
      tx.set(claimDoc.ref, { attempts, updated_at: now }, { merge: true })
      return { status: 400, body: { error: `Invalid verification code. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.` } }
    }

    // Code is correct — record the verified claim, but route it through admin
    // approval rather than auto-granting ownership. The admin approves in the
    // claims dashboard, which finalizes the tier and advertiser flag.

    // Preserve a paid Sales Desk entitlement when Stripe already confirmed it.
    // If the customer claims first, the listing stays Basic until its separate
    // payment handoff completes and the webhook promotes the pending tier.
    const pendingTier = directoryClaimPendingTier(listing)
    tx.set(claimDoc.ref, { status: 'verified', updated_at: now }, { merge: true })
    tx.set(listingRef,
      {
        owner_id: user.id,
        // Re-attaching an owner to an ALREADY-APPROVED listing must not send it
        // back through review. That listing is live and paid for — demoting it
        // to pending_approval would unpublish a paying customer's page and drop
        // its tier, which is a far worse outcome than the lockout being fixed.
        // Its tier is already correct and already billed, so pending_tier is
        // left alone too.
        ...(reattachingOwner
          ? { claim_status: 'approved' }
          : { claim_status: 'pending_approval', pending_tier: pendingTier }),
        ownership_verified: true,
        verification_method: claim.verification_method || 'unknown',
        verified_at: now,
        claimed_at: now,
        updated_at: now,
      },
      { merge: true }
    )

    return { status: 200, body: {
      success: true,
      status: 'pending_approval',
      pending_tier: pendingTier,
      message: 'Ownership verified! Your claim is now pending review by our team and will be approved shortly.',
    } }
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error: any) {
    console.error('Error verifying claim code:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
