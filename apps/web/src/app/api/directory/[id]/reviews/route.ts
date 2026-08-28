import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sanitizePublicReview, shouldAwardReviewPoints } from '@/lib/directory-security'
import { notifyUser } from '@/lib/user-notifications'
import { awardPoints } from '@/lib/points-server'

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

    // Award points atomically + idempotently (ledger-backed): the review
    // itself, plus a bonus for each photo the reviewer contributed. Advertisers
    // earn nothing. A retry can never double-award (deterministic ledger id).
    const reviewerDoc = await adminDb.collection('profiles').doc(user.id).get()
    const reviewerProfile = reviewerDoc.exists ? (reviewerDoc.data() as any) : null
    const isAdvertiser = Boolean(reviewerProfile?.is_advertiser)
    await awardPoints({ userId: user.id, event: 'review', sourceId: reviewRef.id, isAdvertiser })
    if (cleanPhotoUrls.length > 0) {
      await awardPoints({
        userId: user.id,
        event: 'review_photo',
        sourceId: reviewRef.id,
        isAdvertiser,
        meta: { photos: cleanPhotoUrls.length },
      })
    }

    // Recalculate listing rating aggregates.
    const allSnap = await adminDb.collection('directory_reviews').where('listing_id', '==', id).get()
    const count = allSnap.size
    const sum = allSnap.docs.reduce((acc, d) => acc + ((d.data() as any).rating || 0), 0)
    const average = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0

    const listingRef = adminDb.collection('directory_listings').doc(id)
    await listingRef.set({ rating: average, user_ratings_total: count, updated_at: new Date().toISOString() }, { merge: true })

    // Owner notification: first-party inbox record + preference-gated email.
    // (Replaces the old `sent_notifications` log rows, which recorded sends
    // that never actually happened.)
    const listingDoc = await listingRef.get()
    const listing = listingDoc.exists ? (listingDoc.data() as any) : null
    if (listing?.owner_id) {
      const bizName = String(listing.name || 'your business')
      await notifyUser({
        userId: listing.owner_id,
        type: 'review',
        title: `New ${intRating}-star review for ${bizName}`,
        title_es: `Nueva reseña de ${intRating} estrellas para ${bizName}`,
        body: comment ? String(comment).slice(0, 300) : 'No comment was left.',
        body_es: comment ? String(comment).slice(0, 300) : 'Sin comentario.',
        link: `/dashboard/listings/${id}`,
      })
    }

    return NextResponse.json({ review: newReview })
  } catch (error: any) {
    console.error('Error posting review:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
