import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const FROM = process.env.LEADS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

// Public "request a quote / contact this business" lead capture. Stores the lead
// and emails it to the business (a tangible Premium perk + a sellable lead source).
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

  try {
    await adminDb.collection('quote_requests').add({
      listing_id: listingId,
      business_name: listing?.name || null,
      owner_id: listing?.owner_id || null,
      name,
      contact,
      message: message || null,
      status: 'new',
      created_at: FieldValue.serverTimestamp(),
    })
  } catch {
    return NextResponse.json({ error: 'Could not submit request' }, { status: 500 })
  }

  // Email the business if we have an address for them (best effort).
  const to = listing?.contact_email || listing?.email
  if (to) {
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="font-weight:900">New lead from CityBeat</h2>
      <p>You received a quote request${listing?.name ? ` for <strong>${listing.name}</strong>` : ''}:</p>
      <p><strong>From:</strong> ${name}<br/><strong>Contact:</strong> ${contact}</p>
      ${message ? `<p><strong>Message:</strong><br/>${message}</p>` : ''}
      <p style="font-size:11px;color:#999">Sent via citybeatmag.co</p></div>`
    await sendEmail(to, `New CityBeat lead${listing?.name ? `: ${listing.name}` : ''}`, html, FROM).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
