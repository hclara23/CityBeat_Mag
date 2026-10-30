import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { resolveApartmentListing, ApartmentLinkError } from '@/lib/apartment-listing'
import { acceptsClaimSmsConsent } from '@/lib/claim-sms-consent'
import { apartmentClaimError } from '@/lib/apartment-claim-response'
import { POST as startDirectoryClaim } from '@/app/api/directory/[id]/claim/start/route'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!await getServerUser()) return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || !acceptsClaimSmsConsent(body.smsConsent, body.smsConsentVersion)) {
    return NextResponse.json({ errorCode: 'consent_required' }, { status: 400 })
  }
  try {
    const listing = await resolveApartmentListing(adminDb, (await params).slug, true)
    if (!listing) return NextResponse.json({ errorCode: 'not_found' }, { status: 404 })
    if (listing.data.is_published === false || listing.data.owner_id) {
      return NextResponse.json({ errorCode: 'already_claimed' }, { status: 409 })
    }
    // Strip untrusted method, destination and listing IDs. Directory verification
    // uses the stored contact and retains its auth, consent and throttling checks.
    const forwarded = new NextRequest(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'phone', smsConsent: true, smsConsentVersion: body.smsConsentVersion, locale: body.locale === 'es' ? 'es' : 'en' }) })
    const result = await startDirectoryClaim(forwarded, { params: Promise.resolve({ id: listing.id }) })
    const data = await result.json()
    return NextResponse.json(result.ok ? { recipient: data.recipient, status: data.status } : { errorCode: apartmentClaimError(result.status, data.error) }, { status: result.status })
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof ApartmentLinkError ? 'unavailable' : 'internal_error' }, { status: 503 })
  }
}
