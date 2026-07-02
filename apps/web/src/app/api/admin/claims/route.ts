import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Listings awaiting approval, each with ownership-verification evidence so
    // the reviewer can tell "verified control of the business's on-record email"
    // apart from "stranger who just paid" before granting ownership.
    const claimsSnap = await adminDb
      .collection('directory_listings')
      .where('claim_status', '==', 'pending_approval')
      .get()
    const claims = await Promise.all(
      claimsSnap.docs.map(async (d) => {
        const x = d.data() as any
        let ownerEmail: string | null = null
        if (x.owner_id) {
          const p = await adminDb.collection('profiles').doc(x.owner_id).get().catch(() => null)
          ownerEmail = p?.exists ? ((p.data() as any).email ?? null) : null
        }
        return {
          id: d.id,
          ...x,
          claimed_at: toIso(x.claimed_at),
          verified_at: toIso(x.verified_at),
          // Verified = passed the email-code flow (verify route sets verified_at;
          // the Stripe webhook sets ownership_verified for paid claims).
          ownership_verified: Boolean(x.ownership_verified || x.verified_at),
          verification_method: x.verification_method || null,
          owner_email: ownerEmail,
          listed_email: x.email || null,
          sold_by_rep: x.sold_by_rep || null,
        }
      })
    )
    claims.sort((a: any, b: any) => (String(b.claimed_at) > String(a.claimed_at) ? 1 : -1))

    // Postcard claims pending review.
    const pcSnap = await adminDb
      .collection('directory_claims')
      .where('verification_method', '==', 'postcard')
      .get()
    const pcDocs = pcSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((c: any) => ['pending', 'code_sent'].includes(c.status))

    const postcardClaims = await Promise.all(
      pcDocs.map(async (c: any) => {
        const [lDoc, pDoc] = await Promise.all([
          c.listing_id ? adminDb.collection('directory_listings').doc(c.listing_id).get() : null,
          c.user_id ? adminDb.collection('profiles').doc(c.user_id).get() : null,
        ])
        const l = lDoc?.exists ? (lDoc.data() as any) : null
        const p = pDoc?.exists ? (pDoc.data() as any) : null
        return {
          id: c.id,
          listing_id: c.listing_id,
          user_id: c.user_id,
          verification_method: c.verification_method,
          verification_code: c.verification_code,
          status: c.status,
          created_at: toIso(c.created_at),
          listing: l ? { name: l.name, address: l.address, category: l.category } : null,
          profile: p ? { email: p.email } : null,
        }
      })
    )
    postcardClaims.sort((a, b) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    return NextResponse.json({ claims, postcardClaims })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
