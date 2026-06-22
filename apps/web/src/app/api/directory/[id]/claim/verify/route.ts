import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function createdMs(v: any): number {
  if (v?.toDate) return v.toDate().getTime()
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const claim = claimDoc.data() as any

    const now = new Date().toISOString()
    const MAX_ATTEMPTS = 5

    if (claim.verification_code !== String(code).trim()) {
      const attempts = (claim.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        // Too many wrong guesses — invalidate the code so it must be re-requested.
        await claimDoc.ref.set({ status: 'failed', attempts, updated_at: now }, { merge: true })
        return NextResponse.json(
          { error: 'Too many incorrect attempts. Please request a new code.' },
          { status: 429 }
        )
      }
      await claimDoc.ref.set({ attempts, updated_at: now }, { merge: true })
      return NextResponse.json(
        { error: `Invalid verification code. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.` },
        { status: 400 }
      )
    }

    // Code is correct — record the verified claim, but route it through admin
    // approval rather than auto-granting ownership. The admin approves in the
    // claims dashboard, which finalizes the tier and advertiser flag.
    await claimDoc.ref.set({ status: 'verified', updated_at: now }, { merge: true })
    await adminDb.collection('directory_listings').doc(listingId).set(
      {
        owner_id: user.id,
        claim_status: 'pending_approval',
        pending_tier: 'basic',
        verification_method: claim.verification_method || 'unknown',
        verified_at: now,
        claimed_at: now,
        updated_at: now,
      },
      { merge: true }
    )

    return NextResponse.json({
      success: true,
      status: 'pending_approval',
      message: 'Ownership verified! Your claim is now pending review by our team and will be approved shortly.',
    })
  } catch (error: any) {
    console.error('Error verifying claim code:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
