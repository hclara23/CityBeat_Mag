import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'
import { notifyUser } from '@/lib/user-notifications'
import { sendUnclaimedRelay } from '@/lib/unclaimed-relay'

export const dynamic = 'force-dynamic'

const FROM = process.env.LEADS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Public "request a quote / contact this business" lead capture.
//
// The lead ladder (this is the monetization):
//   Premium/Featured owner  → full lead delivered by email immediately.
//   Claimed basic owner     → teaser email; contact details unlock on Premium.
//   Unclaimed listing       → teaser email; claiming (free) reveals the lead —
//                             the strongest claim-conversion hook we have.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`quote:ip:${ip}`, { max: 15, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const listingId = str(body.listingId, 80)
  const name = str(body.name)
  const contact = str(body.contact) // email or phone
  const message = str(body.message, 1500)

  if (!listingId || !name || !contact) {
    return NextResponse.json({ error: 'Name and contact are required.' }, { status: 400 })
  }
  // A valid Firestore listing id — rejecting '/' also avoids the odd-segment
  // throw when building the listing_stats doc id below. ':' must be allowed:
  // ScrapeFlow (sf:<hash>) and OSM (osm:node:<id>) listings use it in doc ids.
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(listingId)) {
    return NextResponse.json({ error: 'Invalid listing.' }, { status: 400 })
  }

  let listing: any = null
  try {
    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    listing = doc.exists ? doc.data() : null
  } catch { /* ignore */ }

  // Require a real listing so a garbage id can't seed junk quote_requests /
  // listing_stats docs or email-bomb via the notification below.
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found.' }, { status: 404 })
  }

  const isClaimed = listing?.claim_status === 'approved' && Boolean(listing?.owner_id)
  const isPremium = isClaimed && ['premium', 'featured'].includes(listing?.tier)
  // gated = the business hasn't paid for lead access; details live in the
  // dashboard (basic) or behind the claim flow (unclaimed).
  const gated = !isPremium

  let quoteId = ''
  try {
    const quoteRef = await adminDb.collection('quote_requests').add({
      listing_id: listingId,
      business_name: listing?.name || null,
      owner_id: listing?.owner_id || null,
      name,
      contact,
      message: message || null,
      status: 'new',
      gated,
      listing_tier_at_capture: listing?.tier || 'basic',
      created_at: FieldValue.serverTimestamp(),
    })
    quoteId = quoteRef.id
  } catch {
    return NextResponse.json({ error: 'Could not submit request' }, { status: 500 })
  }

  // Listing analytics: count the lead in the per-day aggregate (server-derived —
  // never client-reported). Best effort.
  {
    const day = new Date().toISOString().slice(0, 10)
    void adminDb
      .collection('listing_stats')
      .doc(`${listingId}_${day}`)
      .set(
        { listing_id: listingId, day, lead: FieldValue.increment(1), updated_at: new Date().toISOString() },
        { merge: true }
      )
      .catch(() => {})
  }

  // First-party inbox record for the owner. The email below already delivers
  // the lead to the business, so the record skips the email channel.
  if (listing?.owner_id) {
    await notifyUser({
      userId: String(listing.owner_id),
      type: 'lead',
      title: `New customer inquiry for ${listing?.name || 'your business'}`,
      title_es: `Nueva solicitud de cliente para ${listing?.name || 'tu negocio'}`,
      body: 'A customer requested a quote from your listing.',
      body_es: 'Un cliente pidió una cotización desde tu ficha.',
      link: `/dashboard/listings/${listingId}`,
      emailChannel: false,
    }).catch(() => {})
  }

  // Notify the business (best effort).
  const to = listing?.contact_email || listing?.email
  if (to && (isPremium || isClaimed)) {
    const bizName = listing?.name ? esc(String(listing.name)) : ''
    let subject: string
    let html: string

    if (isPremium) {
      // Full lead — the tangible Premium perk.
      subject = `New CityBeat lead${bizName ? `: ${bizName}` : ''}`
      html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="font-weight:900">New lead from CityBeat</h2>
        <p>You received a quote request${bizName ? ` for <strong>${bizName}</strong>` : ''}:</p>
        <p><strong>From:</strong> ${esc(name)}<br/><strong>Contact:</strong> ${esc(contact)}</p>
        ${message ? `<p><strong>Message:</strong><br/>${esc(message)}</p>` : ''}
        <p style="font-size:11px;color:#999">Sent via citybeatmag.co — delivered instantly with your Premium listing.</p></div>`
    } else {
      // Claimed basic → dashboard teaser + Premium upsell.
      subject = `A customer is trying to reach ${bizName || 'your business'} on CityBeat`
      html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="font-weight:900">You have a new customer inquiry</h2>
        <p>Someone just asked to be contacted by <strong>${bizName || 'your business'}</strong> through CityBeat.</p>
        <p>Their contact details are waiting in your dashboard — upgrade to <strong>Premium ($19.99/mo)</strong> to see this and every future lead instantly.</p>
        <p style="margin:24px 0"><a href="${APP_URL}/en/dashboard" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">View my leads</a></p>
        <p style="font-size:11px;color:#999">Sent via citybeatmag.co</p></div>`
    }

    await sendEmail(to, subject, html, FROM).catch(() => {})
  } else if (to) {
    // Unclaimed → relay through the shared unclaimed pipe (bilingual, deduped
    // per quote, suppression-aware, capped per listing, unsubscribe link).
    // The FIRST lead ever is forwarded in full — "this one was free" — which is
    // both the honest move for the customer (they get served) and the strongest
    // claim hook; the relay claims that slot internally AFTER its gates pass, so
    // a blocked send can't burn it. Every later lead gets the same teaser a
    // claimed-basic listing gets, so claiming never REDUCES what a business
    // receives. Awaited (never throws): Cloud Run can freeze CPU after the
    // response, so a detached send could consume the dedupe without sending.
    await sendUnclaimedRelay({
      listingId,
      listing: listing || {},
      eventId: quoteId || `${listingId}-${Date.now()}`,
      detail: { type: 'quote', name, contact, message: message || null },
    })
  }

  return NextResponse.json({ ok: true })
}
