import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.href
  } catch {
    return null
  }
}

// A member of the public contributes a photo of a business. The photo does NOT
// go straight onto the public gallery — it lands as a PENDING contribution the
// owner (or an admin) approves, at which point the contributor earns points and
// the photo joins the gallery. This is the "general public uploads images and
// earns points" flow; approval is the moderation gate that keeps a public
// upload path from defacing a listing.
//
// GET returns the APPROVED public contributions for a listing (for the gallery
// + photo credits). POST submits a new pending contribution.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const snap = await adminDb
      .collection('listing_photos')
      .where('listing_id', '==', id)
      .where('status', '==', 'approved')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const photos = snap.docs.map((d) => {
      const x = d.data() as any
      return { id: d.id, url: x.url, contributor_name: x.contributor_name || 'A CityBeat contributor', created_at: x.created_at }
    })
    return NextResponse.json({ photos })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load photos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Sign in to contribute a photo.' }, { status: 401 })

  const rl = await checkRateLimit(`listing-photo:ip:${getClientIp(request)}`, { max: 15, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const url = sanitizeImageUrl(body.url)
  const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 200) : ''
  if (!url) return NextResponse.json({ error: 'A valid image URL is required.' }, { status: 400 })

  const listingRef = adminDb.collection('directory_listings').doc(id)
  const listingSnap = await listingRef.get()
  if (!listingSnap.exists) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  const listing = listingSnap.data() as any

  // The owner adding their own photo isn't a "contribution" — it goes straight
  // to their gallery through the owner CMS, not here.
  if (listing.owner_id === user.id) {
    return NextResponse.json({ error: 'Use your listing manager to add your own photos.' }, { status: 400 })
  }

  const profileSnap = await adminDb.collection('profiles').doc(user.id).get()
  const profile = profileSnap.exists ? (profileSnap.data() as any) : null

  const photoRef = adminDb.collection('listing_photos').doc()
  await photoRef.set({
    listing_id: id,
    url,
    caption: caption || null,
    contributor_id: user.id,
    contributor_name: profile?.full_name || 'A CityBeat contributor',
    status: 'pending', // owner/admin approves before it's public + earns points
    created_at: FieldValue.serverTimestamp(),
  })

  // Tell the owner a customer added a photo (bilingual inbox + pref-gated email).
  if (listing.owner_id) {
    await notifyUser({
      userId: String(listing.owner_id),
      notificationId: `listing_photo:${photoRef.id}`,
      type: 'listing_photo',
      title: `New photo of ${listing.name || 'your business'}`,
      title_es: `Nueva foto de ${listing.name || 'tu negocio'}`,
      body: 'A customer added a photo to your listing — approve it to show it on your page.',
      body_es: 'Un cliente agregó una foto a tu ficha — apruébala para mostrarla en tu página.',
      link: `/dashboard/listings/${id}`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, status: 'pending', id: photoRef.id }, { status: 201 })
}
