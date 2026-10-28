import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { recordClaimEvent } from '@/lib/claim-funnel'
import { DIRECTORY_PLANS } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// The one claim-funnel step the browser has to report: the claim page rendered.
// (code_requested and checkout_started are recorded by their own API routes.)
//
// Sign-in state is read from the SESSION here, never from the request body. It is
// the whole point of the event, and a client-supplied flag would be wrong exactly
// when something was broken. Only an existing listing is recorded, so a guessed id
// cannot create rows, and the caller's IP is rate-limited.
export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(`claim-step:ip:${getClientIp(request)}`, { max: 60, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const listingId = typeof body?.listing_id === 'string' ? body.listing_id : ''
  if (body?.step !== 'view' || !/^[A-Za-z0-9:_-]{1,120}$/.test(listingId)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!doc.exists) return NextResponse.json({ ok: false }, { status: 404 })
    const user = await getServerUser().catch(() => null)
    const plan =
      typeof body?.plan === 'string' && Object.prototype.hasOwnProperty.call(DIRECTORY_PLANS, body.plan) ? body.plan : null
    await recordClaimEvent({
      step: 'view',
      listing_id: listingId,
      user_id: user?.id ?? null,
      signed_in: Boolean(user),
      locale: body?.locale === 'es' ? 'es' : 'en',
      plan,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
