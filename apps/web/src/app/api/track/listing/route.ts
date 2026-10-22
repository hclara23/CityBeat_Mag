import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { trackListingRequest } from '@/lib/listing-tracking'
import { recordListingAction } from '@/lib/listing-tracking-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const result = await trackListingRequest(await request.json().catch(() => null), {
    allowed: async listingId => (await checkRateLimit(`listing-track:${listingId}:${getClientIp(request)}`, {
      max: 60, windowMs: 60 * 60 * 1000,
    })).ok,
    listing: async listingId => {
      const doc = await adminDb.collection('directory_listings').doc(listingId).get()
      return doc.exists ? doc.data()! : null
    },
    visitor: async () => {
      const user = await getServerUser()
      return user ? { id: user.id, profile: await getServerUserProfile(user.id) } : null
    },
    record: (listingId, type) => recordListingAction(adminDb, listingId, type),
    // Do not log visitor identity or payloads, and do not send email per click.
    failure: () => console.error('[listing-tracking] persistence_or_lookup_failed'),
  })
  return NextResponse.json(result.body, { status: result.status })
}
