import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const FEATURE_PRICE_CENTS = Number(process.env.EVENT_FEATURE_PRICE_CENTS) || 2500

// Public "submit an event" endpoint. Creates a PENDING event for admin review.
// Community-driven events are the owned local-events database (no external API).
export async function POST(request: NextRequest) {
  // Light rate limit to deter spam.
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`event-submit:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const title_en = str(body.title)
  const start_date = str(body.start_date, 40)
  const venue = str(body.venue)
  const description = str(body.description, 2000)
  const ticket_url = str(body.ticket_url, 500)
  const image_url = str(body.image_url, 500)
  const submitter_email = str(body.submitter_email, 200)

  if (!title_en || !start_date) {
    return NextResponse.json({ error: 'Event title and date are required.' }, { status: 400 })
  }
  // Basic ISO/date sanity.
  if (Number.isNaN(Date.parse(start_date))) {
    return NextResponse.json({ error: 'Please provide a valid date/time.' }, { status: 400 })
  }

  const wantsFeature = body.feature === true

  try {
    const ref = await adminDb.collection('events').add({
      title_en,
      title_es: title_en, // editor can translate on approval
      meta_en: description,
      meta_es: description,
      venue: venue || null,
      start_date: new Date(start_date).toISOString(),
      ticket_url: ticket_url || null,
      image_url: image_url || null,
      status: 'pending',
      featured: false,
      source: 'community',
      submitter_email: submitter_email || null,
      created_at: FieldValue.serverTimestamp(),
    })

    // Paid "feature this event": send to Stripe; the webhook flips featured +
    // approved on payment. Free submissions just go to the moderation queue.
    if (wantsFeature && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
      const origin = request.headers.get('origin') || new URL(request.url).origin
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: submitter_email || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: FEATURE_PRICE_CENTS,
              product_data: { name: `Featured event: ${title_en}` },
            },
          },
        ],
        success_url: `${origin}/en/events?status=featured`,
        cancel_url: `${origin}/en/events/submit?status=cancel`,
        metadata: { type: 'event_feature', event_id: ref.id },
      })
      return NextResponse.json({ ok: true, id: ref.id, url: session.url, featurePrice: FEATURE_PRICE_CENTS })
    }

    return NextResponse.json({ ok: true, id: ref.id, featurePrice: FEATURE_PRICE_CENTS })
  } catch (error: any) {
    return NextResponse.json({ error: 'Could not submit event' }, { status: 500 })
  }
}
