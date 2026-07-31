import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { evaluateClaimAcceptance } from '@/lib/verification-audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Accept ownership of a salesperson-attested (bypassed) listing. The bypass
// removed only the second business-verification challenge — this route still
// requires the customer to be signed in with the EXACT recorded email and to
// present the signed, single-use, unexpired token. Free listings activate on
// acceptance; paid listings only bind ownership (the tier stays gated on Stripe).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id: listingId } = params
  if (!listingId) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to accept this listing.' }, { status: 401 })
  }
  // Proving control of the recorded inbox is the ownership assurance that
  // replaces the bypassed email-code challenge — a verified email is required.
  if (!user.email_verified) {
    return NextResponse.json(
      { error: 'Verify your email address first, then accept this listing.' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) return NextResponse.json({ error: 'This claim link is invalid.' }, { status: 400 })

  // Random 32-byte tokens already make guessing infeasible; this is defense in depth.
  const rl = await checkRateLimit(`claim-accept:${listingId}:${getClientIp(request)}`, {
    max: 12,
    windowMs: 60 * 60 * 1000,
  })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const listingRef = adminDb.collection('directory_listings').doc(listingId)

  try {
    // Atomic check-and-consume: re-read inside the transaction and set the
    // consumed marker in the same commit so the single-use token can't be raced.
    const outcome = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(listingRef)
      if (!doc.exists) return { ok: false as const, status: 404, code: 'not_found' as const, error: 'Listing not found' }
      const listing = doc.data() as Record<string, any>

      const result = evaluateClaimAcceptance({ token, userEmail: user.email, listing, nowMs: Date.now() })
      if (!result.ok) return result

      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        owner_id: user.id,
        ownership_verified: true,
        verification_method: 'salesperson_attestation',
        claim_token_consumed_at: now,
        claimed_at: now,
        verified_at: now,
        updated_at: now,
        // Free activates immediately; paid stays pending until Stripe grants the tier.
        claim_status: result.isPaid ? 'pending_approval' : 'approved',
      }
      if (!result.isPaid) patch.tier = 'basic'

      tx.set(listingRef, patch, { merge: true })
      tx.set(adminDb.collection('profiles').doc(user.id), { is_advertiser: true }, { merge: true })
      return { ok: true as const, isPaid: result.isPaid, claimStatus: patch.claim_status as string }
    })

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error, code: outcome.code }, { status: outcome.status })
    }
    return NextResponse.json({
      success: true,
      claim_status: outcome.claimStatus,
      paid: outcome.isPaid,
      message: outcome.isPaid
        ? 'Ownership accepted. Complete payment to activate your paid plan.'
        : 'Ownership accepted! Your free listing is now active.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not accept the listing.' }, { status: 500 })
  }
}
