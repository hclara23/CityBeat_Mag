import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The customer-support path. There wasn't one.
//
// Four different addresses were published across the site — hello@, support@,
// contact@, ads@ — with no page explaining which to use and no way to tell from
// outside which of them is a monitored mailbox. So a business whose payment went
// wrong had to guess, and a guess that lands in an unread inbox is
// indistinguishable from being ignored. That is the worst possible experience to
// give someone who has just been charged.
//
// A form removes the guess entirely: the message is persisted before anything
// else can fail, so it cannot be lost to a bounce or an unwatched mailbox.
//
// It writes into `quote_requests`, which is the inbox /admin/leads already
// renders, rather than inventing a second place for an operator to remember to
// check. A `source` distinguishes it.

const TOPICS = ['billing', 'listing', 'advertising', 'press', 'other'] as const
type Topic = (typeof TOPICS)[number]

// Anything touching money is escalated, not just filed. Someone who has been
// charged and needs help is the one message that must not wait for a dashboard
// visit.
const URGENT: Topic[] = ['billing']

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`contact:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Honeypot — bots fill it, humans never see it. Answer 200 so a bot learns
  // nothing from the difference.
  if (clean((body as any).website, 200)) return NextResponse.json({ ok: true })

  const email = clean((body as any).email, 200).toLowerCase()
  const name = clean((body as any).name, 200)
  const message = clean((body as any).message, 4000)
  const rawTopic = clean((body as any).topic, 40) as Topic
  const topic: Topic = (TOPICS as readonly string[]).includes(rawTopic) ? rawTopic : 'other'
  const locale = clean((body as any).locale, 5) === 'es' ? 'es' : 'en'

  if (!email || !email.includes('@') || !message) {
    return NextResponse.json(
      { error: locale === 'es' ? 'Falta tu correo o tu mensaje.' : 'We need your email and a message.' },
      { status: 400 }
    )
  }

  // Deterministic id: a double-click or a retried POST rewrites the SAME row
  // rather than filling the inbox with duplicates of one person's problem.
  const id = `contact_${createHash('sha256').update(`${email}|${topic}|${message}`).digest('hex').slice(0, 40)}`

  try {
    await adminDb
      .collection('quote_requests')
      .doc(id)
      .set(
        {
          // /admin/leads renders business_name as the subject and only links it
          // when listing_id is set, so this keeps a support message legible there
          // without pretending it belongs to a listing.
          listing_id: null,
          owner_id: null,
          business_name: `Support · ${topic}`,
          name: name || email,
          contact: email,
          message,
          topic,
          locale,
          status: 'new',
          gated: false,
          source: 'contact_page',
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
  } catch (error: any) {
    // Persisting is the whole promise of this endpoint. If it failed, say so
    // rather than showing a thank-you for a message nobody will ever read.
    await reportFailure('contact-form', error, { topic, email }).catch(() => {})
    return NextResponse.json(
      {
        error:
          locale === 'es'
            ? 'No pudimos guardar tu mensaje. Escríbenos directamente a hello@citybeatmag.co.'
            : 'We could not save your message. Please email hello@citybeatmag.co directly.',
      },
      { status: 500 }
    )
  }

  // Only AFTER it is safely stored. reportFailure is the existing operator
  // notification path (Firestore + email, deduped) — reusing it means a support
  // message cannot be lost to a channel nobody has wired up yet.
  if (URGENT.includes(topic)) {
    await reportFailure(
      'contact-billing',
      new Error(`A customer needs help with billing: ${message.slice(0, 200)}`),
      { from: email, name: name || null, locale, topic },
      { skipHealth: true, alertKey: 'contact-billing' }
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
