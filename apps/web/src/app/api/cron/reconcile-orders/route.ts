import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Stripe → Firestore reconciliation: the safety net under the webhook.
//
// The webhook is the ONLY fulfilment path. If a delivery fails, Stripe retries
// for ~3 days and then gives up permanently — and nothing in the system ever
// looked back. A business could pay anywhere from $9.99 to five figures and
// receive no listing upgrade, no published job, no commission accrual and no
// ledger row, existing only in the Stripe dashboard. Nobody would know.
//
// WHY RECONCILE BY EVENT, NOT BY SESSION: the webhook's own idempotency key is
// `stripe_events/{event.id}`, written only after a handler fully succeeds. So
// "did we process this?" has an exact answer rather than a fuzzy one inferred
// from whether some downstream document looks right.
//
// HOW REPLAY IS SAFE: an unprocessed event is re-delivered to our own webhook
// with a genuine signature (we hold STRIPE_WEBHOOK_SECRET, and the payload is
// fetched from Stripe, not synthesised). That reuses the exact production path
// — signature verification, the stripe_events dedupe, commission accrual and
// its four double-pay guards — instead of duplicating money logic here, which
// would bypass that dedupe and could pay a rep twice.
//
// Detection is the default; replay is opt-in via ?replay=1. Knowing a payment
// was dropped is most of the value, and it carries no risk at all.
//   ?dryRun=1  report only, no alert
//   ?replay=1  re-deliver unprocessed events through the webhook
//   ?hours=N   lookback window (default 72, max 720 — Stripe retains 30 days)

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Event types whose loss actually costs a customer something.
const RECONCILED_TYPES = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'charge.refunded',
  'charge.dispute.created',
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const MAX_PAGES = 10 // 100 events/page — a bounded read even after a long outage

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!key) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const wantReplay = searchParams.get('replay') === '1'
  const hours = Math.min(Math.max(parseInt(searchParams.get('hours') || '72', 10) || 72, 1), 720)

  const stripe = new Stripe(key, { apiVersion: '2023-10-16' as any })
  const since = Math.floor(Date.now() / 1000) - hours * 3600

  const unprocessed: Array<{ id: string; type: string; created: string; amount: number | null; livemode: boolean }> = []
  let scanned = 0
  let replayed = 0
  let replayFailed = 0

  try {
    // 1. Walk Stripe's event log for the window.
    let startingAfter: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch: Stripe.ApiList<Stripe.Event> = await stripe.events.list({
        types: RECONCILED_TYPES,
        created: { gte: since },
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      if (batch.data.length === 0) break
      scanned += batch.data.length

      // 2. Which of these did the webhook never finish? One getAll per page.
      const refs = batch.data.map((e) => adminDb.collection('stripe_events').doc(e.id))
      const seen = await adminDb.getAll(...refs)
      const processed = new Set(seen.filter((d) => d.exists).map((d) => d.id))

      for (const event of batch.data) {
        if (processed.has(event.id)) continue
        const obj = event.data.object as any
        // Only money that actually moved matters. An abandoned/unpaid session is
        // not a lost order — checkout-recovery already owns that case.
        if (event.type === 'checkout.session.completed') {
          const paid = obj?.payment_status === 'paid' || obj?.payment_status === 'no_payment_required'
          if (!paid) continue
        }
        unprocessed.push({
          id: event.id,
          type: event.type,
          created: new Date(event.created * 1000).toISOString(),
          amount: typeof obj?.amount_total === 'number' ? obj.amount_total : typeof obj?.amount === 'number' ? obj.amount : null,
          livemode: Boolean(event.livemode),
        })
      }

      if (!batch.has_more) break
      startingAfter = batch.data[batch.data.length - 1].id
    }

    // 3. Optionally heal, by re-delivering through the real webhook.
    if (wantReplay && !dryRun && unprocessed.length > 0) {
      if (!webhookSecret) {
        return NextResponse.json(
          { error: 'STRIPE_WEBHOOK_SECRET is required to replay', unprocessed: unprocessed.length },
          { status: 503 }
        )
      }
      for (const item of unprocessed) {
        try {
          // Fetch the authoritative event body from Stripe and sign it as Stripe
          // would, so our webhook's signature check and every downstream guard
          // run exactly as they do in production.
          const full = await stripe.events.retrieve(item.id)
          const payload = JSON.stringify(full)
          const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret })
          const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
            body: payload,
          })
          if (res.ok) replayed++
          else replayFailed++
        } catch {
          replayFailed++
        }
      }
    }

    // 4. Tell a human. An unprocessed PAID event is a customer who paid and got
    // nothing — that is an incident, not a statistic.
    const stillMissing = unprocessed.length - replayed
    if (!dryRun && stillMissing > 0) {
      await reportFailure(
        'reconcile-orders',
        new Error(`${stillMissing} paid Stripe event(s) were never fulfilled`),
        {
          window_hours: hours,
          unprocessed: unprocessed.length,
          replayed,
          replay_failed: replayFailed,
          sample: unprocessed.slice(0, 5).map((u) => `${u.type}:${u.id}`),
        }
      ).catch(() => {})
    } else if (!dryRun && unprocessed.length === 0) {
      await reportSuccess('reconcile-orders')
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      window_hours: hours,
      scanned,
      unprocessed: unprocessed.length,
      replayed,
      replay_failed: replayFailed,
      replay_enabled: wantReplay,
      events: unprocessed.slice(0, 25),
    })
  } catch (error: any) {
    await reportFailure('reconcile-orders', error, { window_hours: hours }).catch(() => {})
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}
