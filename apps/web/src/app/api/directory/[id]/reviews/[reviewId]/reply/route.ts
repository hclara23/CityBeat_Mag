import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'

export const dynamic = 'force-dynamic'

// Owner reply to a customer review. Manual review replies are an ALL-tiers
// capability (entitlement matrix) — the gate here is ownership/management of
// the listing, not the plan. Empty response clears the reply.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; reviewId: string } }
) {
  const { id: listingId, reviewId } = params
  if (!listingId || !reviewId) {
    return NextResponse.json({ error: 'Missing listing or review ID' }, { status: 400 })
  }

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  const isStaff = hasEditorAccess(profile)

  const listingDoc = await adminDb.collection('directory_listings').doc(listingId).get()
  if (!listingDoc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = listingDoc.data() as Record<string, any>
  const entitlements = resolveEntitlements(listing)
  const { canManage } = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff,
    managerAllowance: entitlements.additionalManagers,
  })
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const response = typeof body.response === 'string' ? body.response.trim().slice(0, 1000) : ''

  const reviewRef = adminDb.collection('directory_reviews').doc(reviewId)
  const reviewDoc = await reviewRef.get()
  if (!reviewDoc.exists || (reviewDoc.data() as any)?.listing_id !== listingId) {
    return NextResponse.json({ error: 'Review not found for this listing' }, { status: 404 })
  }

  const now = new Date().toISOString()
  await reviewRef.set(
    {
      owner_response: response || null,
      owner_response_at: response ? now : null,
      owner_response_by: response ? user.id : null,
      updated_at: now,
    },
    { merge: true }
  )

  return NextResponse.json({ ok: true, owner_response: response || null })
}
