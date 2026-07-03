import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'morningstarelp@gmail.com'

// Public "report this review" — the moderation pressure valve for defamation /
// spam in user reviews. Stores the report and emails the operator with the
// review content so a human can act (delete via admin) quickly.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`reviewreport:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId.slice(0, 80) : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const revDoc = await adminDb.collection('directory_reviews').doc(reviewId).get().catch(() => null)
  if (!revDoc?.exists) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  const rev = revDoc.data() as any

  await adminDb.collection('review_reports').add({
    review_id: reviewId,
    listing_id: rev.listing_id || null,
    reason: reason || null,
    reporter_ip: ip,
    status: 'open',
    created_at: FieldValue.serverTimestamp(),
  })

  const esc = (s: string) => String(s || '').replace(/</g, '&lt;')
  await sendEmail(
    ALERT_EMAIL,
    `[CityBeat] Review reported on listing ${rev.listing_id || '?'}`,
    `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="font-weight:900">Review reported</h2>
      <p><strong>Review (${rev.rating ?? '?'}/5):</strong> ${esc(rev.comment)}</p>
      ${reason ? `<p><strong>Reporter says:</strong> ${esc(reason)}</p>` : ''}
      <p><a href="https://citybeatmag.co/en/directory/${rev.listing_id}">Open the listing</a> — delete the review from Firestore (directory_reviews/${reviewId}) if it violates policy.</p>
    </div>`
  ).catch(() => {})

  return NextResponse.json({ ok: true })
}
