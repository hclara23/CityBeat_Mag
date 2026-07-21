import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from '@/lib/email'
import { sendSms, smsConfigured } from '@/lib/sms'
import { normalizeSalesEmail } from '@/lib/sales-checkout'
import { getSalesProduct, salesProductPriceLabel } from '@/lib/sales-products'
import { salesOrderHandoffMatches } from '@/lib/sales-orders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Lets a rep hand off a Stripe payment link straight from the sales screen —
// emails it (and texts it, if Twilio is configured) to the client so the sale can
// close without the rep copy-pasting into their own phone. Sales/admin only.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''

  // Only forward links to our own checkout — never an arbitrary URL.
  if (!/^https:\/\/(checkout\.stripe\.com|buy\.stripe\.com)\//.test(url)) {
    return NextResponse.json({ error: 'Invalid checkout link' }, { status: 400 })
  }
  if (!email && !phone) {
    return NextResponse.json({ error: 'Provide a client email or phone' }, { status: 400 })
  }
  if (!orderId) {
    return NextResponse.json({ error: 'Sales order reference missing' }, { status: 400 })
  }

  const orderSnapshot = await adminDb.collection('sales_orders').where('checkout_url', '==', url).limit(1).get()
  if (orderSnapshot.empty) {
    return NextResponse.json({ error: 'This checkout is not a CityBeat Sales Desk order.' }, { status: 403 })
  }
  const orderDocument = orderSnapshot.docs[0]
  const order = { id: orderDocument.id, ...orderDocument.data() } as Record<string, any>
  if (!salesOrderHandoffMatches({ order, sellerUserId: user.id, checkoutUrl: url, orderId })) {
    return NextResponse.json({ error: 'This checkout does not belong to your active sale.' }, { status: 403 })
  }

  const canonicalEmail = normalizeSalesEmail(order.contact_email)
  const canonicalPhone = typeof order.contact_phone === 'string' ? order.contact_phone.trim() : ''
  if (email && normalizeSalesEmail(email) !== canonicalEmail) {
    return NextResponse.json({ error: 'Email this link only to the customer recorded on the order.' }, { status: 400 })
  }
  if (phone && phone !== canonicalPhone) {
    return NextResponse.json({ error: 'Text this link only to the phone recorded on the order.' }, { status: 400 })
  }

  const businessName = String(order.business_name || 'your business').replace(/[\r\n]+/g, ' ').slice(0, 140)
  const product = getSalesProduct(order.product_id)
  const priceLabel = product
    ? salesProductPriceLabel(product, Number(order.amount) || 0)
    : `${((Number(order.amount) || 0) / 100).toFixed(2)} USD`

  const results: { email?: any; sms?: any } = {}

  if (email) {
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px">
        <h1 style="font-size:20px;margin:0 0 4px">CityBeat — secure payment link</h1>
        <p style="color:#444;font-size:15px;line-height:1.5">Hi! Here's the secure checkout link to activate <strong>${escapeHtml(businessName)}</strong> on CityBeat${priceLabel ? ` (${escapeHtml(priceLabel)})` : ''}. Payment is processed by Stripe and your receipt is emailed automatically.</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(url)}" style="background:#00e0d1;color:#04121a;font-weight:800;text-decoration:none;padding:14px 24px;border-radius:8px;display:inline-block;font-size:16px">Pay securely →</a>
        </p>
        <p style="color:#888;font-size:12px;word-break:break-all">Or paste this link: ${escapeHtml(url)}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px">CityBeat · El Paso · citybeatmag.co</p>
      </div>`
    results.email = await sendEmail(email, `Your CityBeat payment link for ${businessName}`, html)
  }

  if (phone) {
    const text = `CityBeat: secure payment link to activate ${businessName}${priceLabel ? ` (${priceLabel})` : ''}: ${url}`
    results.sms = smsConfigured() ? await sendSms(phone, text) : { sent: false, error: 'sms_not_configured' }
  }

  // Light audit trail so a rep can see they sent it (and attribution stays clean).
  await adminDb.collection('sales_links_sent').add({
    sent_by: user.id,
    sales_order_id: orderDocument.id,
    stripe_checkout_session_id: order.stripe_checkout_session_id || null,
    business: businessName,
    to_email: email || null,
    to_phone: phone || null,
    email_sent: Boolean(results.email?.sent),
    sms_sent: Boolean(results.sms?.sent),
    at: FieldValue.serverTimestamp(),
  }).catch(() => {})

  const anySent = Boolean(results.email?.sent || results.sms?.sent)
  return NextResponse.json({ ok: anySent, results }, { status: anySent ? 200 : 502 })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
