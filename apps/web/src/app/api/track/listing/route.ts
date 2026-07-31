import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { dayKey, isValidListingEventType, statsDocId } from '@/lib/listing-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Privacy-safe listing analytics: increments a per-listing per-day counter.
// NO visitor identity is stored — no IP, no user id, no user agent. Owner and
// staff self-traffic is excluded so the numbers reflect real customers.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
  const type = body.type
  if (!listingId || listingId.length > 80 || !isValidListingEventType(type)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  // `lead` is derived server-side by the quote route, never from the client.
  if (type === 'lead') return NextResponse.json({ ok: false }, { status: 400 })

  // Abuse guard: cap events per visitor per listing. Fails open on backend error.
  const rl = await checkRateLimit(`listing-track:${listingId}:${getClientIp(request)}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!rl.ok) return NextResponse.json({ ok: true }) // silently drop — never break the page

  try {
    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!doc.exists) return NextResponse.json({ ok: false }, { status: 404 })
    const listing = doc.data() as Record<string, any>

    // Exclude the owner, managers, and staff viewing their own listing.
    const user = await getServerUser().catch(() => null)
    if (user) {
      if (listing.owner_id === user.id) return NextResponse.json({ ok: true, excluded: true })
      if (Array.isArray(listing.manager_ids) && listing.manager_ids.includes(user.id)) {
        return NextResponse.json({ ok: true, excluded: true })
      }
      const profile = await getServerUserProfile(user.id).catch(() => null)
      if (hasEditorAccess(profile)) return NextResponse.json({ ok: true, excluded: true })
    }

    const day = dayKey(new Date())
    await adminDb
      .collection('listing_stats')
      .doc(statsDocId(listingId, day))
      .set(
        {
          listing_id: listingId,
          day,
          [type]: FieldValue.increment(1),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )
    return NextResponse.json({ ok: true })
  } catch {
    // Analytics must never surface errors to visitors.
    return NextResponse.json({ ok: true })
  }
}
