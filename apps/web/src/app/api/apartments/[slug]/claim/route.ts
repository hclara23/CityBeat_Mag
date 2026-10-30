import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { resolveApartmentListing } from '@/lib/apartment-listing'
import { isListingClaimable } from '@/lib/directory-claimability'
import { toE164 } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const listing = await resolveApartmentListing(adminDb, (await params).slug)
    if (!listing) return NextResponse.json({ errorCode: 'not_found' }, { status: 404 })
    const phone = toE164(String(listing.data.phone || ''))
    return NextResponse.json({
      claimable: !listing.data.owner_id && listing.data.is_published !== false && isListingClaimable(listing.data),
      phoneHint: phone ? phone.slice(-4) : '', status: listing.data.claim_status || 'unclaimed',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ errorCode: 'unavailable' }, { status: 503 })
  }
}
