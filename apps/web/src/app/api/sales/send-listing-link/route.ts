import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from '@/lib/email'
import { sendSms, smsConfigured } from '@/lib/sms'
import { normalizeSalesEmail } from '@/lib/sales-checkout'
import { salesDirectoryHandoffMatches } from '@/lib/sales-directory'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
  const listingUrl = typeof body.url === 'string' ? body.url.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const locale = body.locale === 'es' ? 'es' : 'en'
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  if (!listingId || !listingUrl) {
    return NextResponse.json({ error: 'Listing reference missing' }, { status: 400 })
  }
  if (!email && !phone) {
    return NextResponse.json({ error: 'Provide a client email or phone' }, { status: 400 })
  }

  const listingDocument = await adminDb.collection('directory_listings').doc(listingId).get()
  if (!listingDocument.exists) {
    return NextResponse.json({ error: 'Directory listing not found' }, { status: 404 })
  }
  const listing = listingDocument.data() as Record<string, any>
  if (
    !salesDirectoryHandoffMatches({
      listing,
      listingId,
      sellerUserId: user.id,
      listingUrl,
      requestOrigin: appOrigin,
      locale,
    })
  ) {
    return NextResponse.json(
      { error: 'This listing link does not belong to your active new-business handoff.' },
      { status: 403 }
    )
  }

  const canonicalEmail = normalizeSalesEmail(listing.contact_email)
  const canonicalPhone = typeof listing.phone === 'string' ? listing.phone.trim() : ''
  if (email && normalizeSalesEmail(email) !== canonicalEmail) {
    return NextResponse.json(
      { error: 'Email this listing only to the customer recorded on it.' },
      { status: 400 }
    )
  }
  if (phone && phone !== canonicalPhone) {
    return NextResponse.json(
      { error: 'Text this listing only to the phone recorded on it.' },
      { status: 400 }
    )
  }

  const businessName = String(listing.name || 'your business').replace(/[\r\n]+/g, ' ').slice(0, 140)
  const results: { email?: any; sms?: any } = {}

  if (email) {
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px">
        <h1 style="font-size:20px;margin:0 0 4px">Your CityBeat directory listing is ready</h1>
        <p style="color:#444;font-size:15px;line-height:1.5">Review the new listing for <strong>${escapeHtml(businessName)}</strong>, then select <strong>Claim</strong> on the page to verify ownership and manage it.</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(listingUrl)}" style="background:#00e0d1;color:#04121a;font-weight:800;text-decoration:none;padding:14px 24px;display:inline-block;font-size:16px">Open and claim my listing</a>
        </p>
        <p style="color:#888;font-size:12px;word-break:break-all">Or paste this link: ${escapeHtml(listingUrl)}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px">CityBeat | El Paso | citybeatmag.co</p>
      </div>`
    results.email = await sendEmail(
      email,
      `Your CityBeat directory listing for ${businessName}`,
      html
    )
  }

  if (phone) {
    const text = `CityBeat: your directory listing for ${businessName} is ready. Open it and select Claim to verify ownership: ${listingUrl}`
    results.sms = smsConfigured()
      ? await sendSms(phone, text)
      : { sent: false, error: 'sms_not_configured' }
  }

  await adminDb.collection('sales_listing_links_sent').add({
    sent_by: user.id,
    listing_id: listingId,
    business: businessName,
    listing_url: listingUrl,
    to_email: email || null,
    to_phone: phone || null,
    email_sent: Boolean(results.email?.sent),
    sms_sent: Boolean(results.sms?.sent),
    at: FieldValue.serverTimestamp(),
  }).catch(() => {})

  const anySent = Boolean(results.email?.sent || results.sms?.sent)
  return NextResponse.json({ ok: anySent, results }, { status: anySent ? 200 : 502 })
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string
  )
}
