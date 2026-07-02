import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

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

  let listing: any = null
  try {
    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    listing = doc.exists ? doc.data() : null
  } catch { /* ignore */ }

  const isClaimed = listing?.claim_status === 'approved' && Boolean(listing?.owner_id)
  const isPremium = isClaimed && ['premium', 'featured'].includes(listing?.tier)
  // gated = the business hasn't paid for lead access; details live in the
  // dashboard (basic) or behind the claim flow (unclaimed).
  const gated = !isPremium

  try {
    await adminDb.collection('quote_requests').add({
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
  } catch {
    return NextResponse.json({ error: 'Could not submit request' }, { status: 500 })
  }

  // Notify the business (best effort).
  const to = listing?.contact_email || listing?.email
  if (to) {
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
    } else if (isClaimed) {
      // Claimed basic → dashboard teaser + Premium upsell.
      subject = `A customer is trying to reach ${bizName || 'your business'} on CityBeat`
      html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="font-weight:900">You have a new customer inquiry</h2>
        <p>Someone just asked to be contacted by <strong>${bizName || 'your business'}</strong> through CityBeat.</p>
        <p>Their contact details are waiting in your dashboard — upgrade to <strong>Premium ($19/mo)</strong> to see this and every future lead instantly.</p>
        <p style="margin:24px 0"><a href="${APP_URL}/en/dashboard" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">View my leads</a></p>
        <p style="font-size:11px;color:#999">Sent via citybeatmag.co</p></div>`
    } else {
      // Unclaimed → the claim hook. The lead is real and waiting; claiming is free.
      subject = `A customer is trying to reach ${bizName || 'your business'} — CityBeat`
      html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="font-weight:900">You have a customer inquiry waiting</h2>
        <p>Someone just asked to be contacted by <strong>${bizName || 'your business'}</strong> through your listing on CityBeat, El Paso &amp; Ciudad Juárez's bilingual local guide.</p>
        <p><strong>Claim your listing (free)</strong> to see who's trying to reach you — it takes two minutes.</p>
        <p style="margin:24px 0"><a href="${APP_URL}/en/directory/${listingId}/claim" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Claim my business</a></p>
        <p style="font-size:11px;color:#999">Sent via citybeatmag.co · You received this because your business is listed in the public CityBeat directory.</p></div>`
    }

    await sendEmail(to, subject, html, FROM).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
