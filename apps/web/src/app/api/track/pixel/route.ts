import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { resolveEntitlements } from '@/lib/directory-entitlements'
import {
  isAllowedPixelOrigin,
  isPixelEvent,
  pixelKeyMatches,
  pixelStatField,
} from '@/lib/conversion-pixel'
import { dayKey, statsDocId } from '@/lib/listing-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BOT = /bot|crawler|spider|preview|facebookexternalhit|headless|lighthouse/i

function quiet(status = 204) {
  return new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get('user-agent') || '')) return quiet()
  const body = await request.json().catch(() => ({}))
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
  const key = typeof body.key === 'string' ? body.key : ''
  const event = body.event
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(listingId) || !key || !isPixelEvent(event)) return quiet(400)

  const sourceOrigin = request.headers.get('origin') || request.headers.get('referer')
  const rl = await checkRateLimit(`pixel:${listingId}:${getClientIp(request)}`, { max: 120, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return quiet(429)

  try {
    const ref = adminDb.collection('directory_listings').doc(listingId)
    const doc = await ref.get()
    if (!doc.exists) return quiet(404)
    const listing = doc.data() as Record<string, any>
    const pixel = listing.conversion_pixel || {}
    if (
      pixel.enabled !== true ||
      !resolveEntitlements(listing).fullAnalytics ||
      typeof pixel.key_hash !== 'string' ||
      !pixelKeyMatches(key, pixel.key_hash) ||
      !isAllowedPixelOrigin(sourceOrigin, Array.isArray(pixel.domains) ? pixel.domains : [])
    ) return quiet(403)

    const now = new Date()
    const field = pixelStatField(event)
    const writes: Promise<unknown>[] = [
      adminDb.collection('listing_stats').doc(statsDocId(listingId, dayKey(now))).set(
        {
          listing_id: listingId,
          day: dayKey(now),
          [field]: FieldValue.increment(1),
          [`pixel_${event}`]: FieldValue.increment(1),
          updated_at: now.toISOString(),
        },
        { merge: true }
      ),
    ]
    const lastSeen = Date.parse(pixel.last_seen_at || '')
    if (!Number.isFinite(lastSeen) || now.getTime() - lastSeen > 60 * 60 * 1000) {
      writes.push(ref.update({
        'conversion_pixel.last_seen_at': now.toISOString(),
        'conversion_pixel.last_event': event,
      }))
    }
    await Promise.all(writes)
    return quiet()
  } catch {
    // A business website must never fail because analytics is unavailable.
    return quiet()
  }
}
