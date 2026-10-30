import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { resolveApartmentListing } from '@/lib/apartment-listing'
import { apartmentClaimError } from '@/lib/apartment-claim-response'
import { POST as verifyDirectoryClaim } from '@/app/api/directory/[id]/claim/verify/route'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getServerUser()) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code.trim())) {
    return NextResponse.json({ errorCode: 'invalid_code' }, { status: 400 })
  }
  try {
    const listing = await resolveApartmentListing(adminDb, (await params).slug)
    if (!listing) return NextResponse.json({ errorCode: 'not_found' }, { status: 404 })
    if (listing.data.is_published === false) return NextResponse.json({ errorCode: 'unavailable' }, { status: 409 })
    const forwarded = new NextRequest(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: body.code.trim() }) })
    const result = await verifyDirectoryClaim(forwarded, { params: Promise.resolve({ id: listing.id }) })
    const data = await result.json()
    return NextResponse.json(result.ok ? { success: true, status: data.status } : { errorCode: apartmentClaimError(result.status, data.error) }, { status: result.status })
  } catch {
    return NextResponse.json({ errorCode: 'internal_error' }, { status: 503 })
  }
}
