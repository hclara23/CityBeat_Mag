import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json()
  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const ref = adminDb.collection('directory_listings').doc(id)

  try {
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const data = existing.data() as any
    const ownerId = data?.owner_id

    const updates =
      action === 'approve'
        ? {
            claim_status: 'approved',
            // Honor the tier set at claim/checkout time (basic for free claims,
            // premium/featured for paid). Falls back to premium for legacy claims.
            tier: data?.pending_tier || data?.tier || 'premium',
            pending_tier: null,
            claimed_at: data?.claimed_at || now,
            updated_at: now,
          }
        : {
            claim_status: 'unclaimed',
            owner_id: null,
            pending_tier: null,
            verified_at: null,
            stripe_subscription_id: null,
            claimed_at: null,
            updated_at: now,
          }

    await ref.set(updates, { merge: true })

    // On approval, mark the owner as an advertiser so their dashboards unlock.
    if (action === 'approve' && ownerId) {
      await adminDb.collection('profiles').doc(ownerId).set({ is_advertiser: true }, { merge: true })
    }
    const doc = await ref.get()
    return NextResponse.json({
      success: true,
      listing: { id: doc.id, ...doc.data(), updated_at: toIso(doc.data()?.updated_at) },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
