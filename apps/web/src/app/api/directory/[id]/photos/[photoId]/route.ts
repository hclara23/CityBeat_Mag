import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { awardPoints } from '@/lib/points-server'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Owner (or staff) approves/rejects a public photo contribution. Approval is
// what publishes the photo onto the gallery AND awards the contributor their
// points (idempotent via the ledger) — so points only ever land for a photo a
// real business accepted, which is the abuse gate on the public upload path.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await params
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)

  const body = await request.json().catch(() => ({}))
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : ''
  if (!action) return NextResponse.json({ error: 'action (approve|reject) required' }, { status: 400 })

  const listingSnap = await adminDb.collection('directory_listings').doc(id).get()
  if (!listingSnap.exists) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  const listing = listingSnap.data() as any

  // Who may moderate. This used a raw `listing.owner_id === user.id`, which is
  // NOT the ownership rule the rest of the directory uses: resolveListingPatchAccess
  // additionally requires claim_status === 'approved'. owner_id is written when a
  // claim is SUBMITTED, so a claimant an admin had not yet approved (or whose claim
  // was rejected) could approve photos onto a business's public gallery — a public
  // upload path with the moderation gate opened by the person being moderated. It
  // also ignored the paid manager seats, so a Premium/Featured owner's managers
  // were locked out of a job the plan sells them.
  const entitlements = resolveEntitlements(listing)
  const { canManage } = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff: hasEditorAccess(profile),
    managerAllowance: entitlements.additionalManagers,
  })
  if (!canManage) {
    return NextResponse.json({ error: 'Only the business owner can manage its photos.' }, { status: 403 })
  }

  const photoRef = adminDb.collection('listing_photos').doc(photoId)
  const photoSnap = await photoRef.get()
  if (!photoSnap.exists) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  const photo = photoSnap.data() as any
  if (photo.listing_id !== id) return NextResponse.json({ error: 'Photo does not belong to this listing' }, { status: 400 })

  const now = new Date().toISOString()

  if (action === 'reject') {
    await photoRef.set({ status: 'rejected', moderated_by: user.id, moderated_at: now }, { merge: true })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // Approve: publish onto the gallery, award the contributor (idempotent), and
  // thank them in-app.
  if (photo.status !== 'approved') {
    await photoRef.set({ status: 'approved', moderated_by: user.id, moderated_at: now }, { merge: true })
    await adminDb
      .collection('directory_listings')
      .doc(id)
      .set({ gallery_urls: FieldValue.arrayUnion(photo.url), updated_at: now }, { merge: true })
      .catch(() => {})

    if (photo.contributor_id) {
      const contributorProfile = await adminDb.collection('profiles').doc(photo.contributor_id).get()
      const isAdvertiser = Boolean(contributorProfile.exists && (contributorProfile.data() as any)?.is_advertiser)
      const { awarded } = await awardPoints({
        userId: String(photo.contributor_id),
        event: 'business_photo',
        sourceId: photoId,
        isAdvertiser,
        meta: { listing_id: id },
      })
      await notifyUser({
        userId: String(photo.contributor_id),
        notificationId: `points_awarded:business_photo:${photoId}`,
        type: 'points_awarded',
        title: awarded > 0 ? `You earned ${awarded} points!` : 'Your photo was published',
        title_es: awarded > 0 ? `¡Ganaste ${awarded} puntos!` : 'Tu foto fue publicada',
        body: `Your photo of ${listing.name || 'a local business'} is now live on CityBeat.`,
        body_es: `Tu foto de ${listing.name || 'un negocio local'} ya está publicada en CityBeat.`,
        link: `/directory/${id}`,
        emailChannel: false,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, status: 'approved' })
}
