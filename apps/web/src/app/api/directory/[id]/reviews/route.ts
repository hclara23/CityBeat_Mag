import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sanitizePublicReview, shouldAwardReviewPoints } from '@/lib/directory-security'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

// GET: Fetch reviews for a listing, joining reviewer profiles
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  try {
    const snap = await adminDb.collection('directory_reviews').where('listing_id', '==', id).get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any), created_at: toIso((d.data() as any).created_at) }))

    // Join reviewer profiles.
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))]
    const profileMap = new Map<string, any>()
    await Promise.all(
      userIds.map(async (uid: any) => {
        const p = await adminDb.collection('profiles').doc(uid).get()
        if (p.exists) profileMap.set(uid, p.data())
      })
    )

    const reviews = rows
      .map((r: any) => {
        const p = profileMap.get(r.user_id)
        return { ...r, profiles: p ? { full_name: p.full_name, avatar_url: p.avatar_url } : null }
      })
      .sort((a: any, b: any) => (String(b.created_at) > String(a.created_at) ? 1 : -1))
      .map(sanitizePublicReview)

    return NextResponse.json({ reviews })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// POST: Leave a review, updating listing rating aggregates + owner notifications
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please log in to leave a review.' }, { status: 401 })
  }

  try {
    const { rating, comment, photo_urls } = await request.json()
    const intRating = parseInt(rating, 10)
    if (isNaN(intRating) || intRating < 1 || intRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }
    const cleanPhotoUrls = Array.isArray(photo_urls) ? photo_urls.filter((u) => typeof u === 'string') : []

    // One review per user per listing.
    const existingSnap = await adminDb
      .collection('directory_reviews')
      .where('listing_id', '==', id)
      .where('user_id', '==', user.id)
      .limit(1)
      .get()
    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'You have already reviewed this listing.' }, { status: 409 })
    }

    const reviewRef = await adminDb.collection('directory_reviews').add({
      listing_id: id,
      user_id: user.id,
      rating: intRating,
      comment: comment || '',
      photo_urls: cleanPhotoUrls,
      created_at: FieldValue.serverTimestamp(),
    })
    const newReview = { id: reviewRef.id, listing_id: id, user_id: user.id, rating: intRating, comment: comment || '', photo_urls: cleanPhotoUrls }

    // Award review points to non-advertisers.
    const reviewerDoc = await adminDb.collection('profiles').doc(user.id).get()
    const reviewerProfile = reviewerDoc.exists ? (reviewerDoc.data() as any) : null
    if (
      reviewerProfile &&
      shouldAwardReviewPoints({ isAdvertiser: Boolean(reviewerProfile.is_advertiser), hasExistingReview: false })
    ) {
      await adminDb
        .collection('profiles')
        .doc(user.id)
        .set({ review_points: (reviewerProfile.review_points || 0) + 10 }, { merge: true })
    }

    // Recalculate listing rating aggregates.
    const allSnap = await adminDb.collection('directory_reviews').where('listing_id', '==', id).get()
    const count = allSnap.size
    const sum = allSnap.docs.reduce((acc, d) => acc + ((d.data() as any).rating || 0), 0)
    const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0

    const listingRef = adminDb.collection('directory_listings').doc(id)
    await listingRef.set({ rating: average, user_ratings_total: count, updated_at: new Date().toISOString() }, { merge: true })

    // Owner notifications.
    const listingDoc = await listingRef.get()
    const listing = listingDoc.exists ? (listingDoc.data() as any) : null
    if (listing?.owner_id) {
      const ownerDoc = await adminDb.collection('profiles').doc(listing.owner_id).get()
      const owner = ownerDoc.exists ? (ownerDoc.data() as any) : null
      if (owner) {
        if (owner.email_notifications_enabled && owner.email) {
          await adminDb.collection('sent_notifications').add({
            user_id: listing.owner_id,
            type: 'email',
            recipient: owner.email,
            subject: `New review for ${listing.name}`,
            body: `Your business "${listing.name}" received a new ${intRating}-star review.\n\n"${comment || '(No comment)'}"`,
            created_at: FieldValue.serverTimestamp(),
          })
        }
        if (owner.sms_notifications_enabled && owner.phone_number) {
          await adminDb.collection('sent_notifications').add({
            user_id: listing.owner_id,
            type: 'sms',
            recipient: owner.phone_number,
            body: `CityBeat Alert: ${listing.name} got a new ${intRating}-star review.`,
            created_at: FieldValue.serverTimestamp(),
          })
        }
      }
    }

    return NextResponse.json({ review: newReview })
  } catch (error: any) {
    console.error('Error posting review:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
