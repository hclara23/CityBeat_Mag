import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { getSalesProduct } from '@/lib/sales-products'
import { planRecovery, recoveryEmail } from '@/lib/checkout-recovery'
import { FOUNDERS_PROMO, foundersOfferEmail, isFoundersPromoEligible } from '@/lib/promo'
import { createSalesOrderAccess } from '@/lib/sales-orders'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Abandoned-checkout recovery.
//
// Two separable jobs, deliberately gated differently:
//
//   1. MARK (always) — write the truth back onto orders whose Stripe session has
//      lapsed. Purely internal: the Sales Desk stops telling reps that eleven
//      dead payment links are live. No outbound contact, nothing to opt into.
//
//   2. NUDGE (opt-in) — email the customer once, inviting a reply for a fresh
//      link. This contacts real businesses on the operator's behalf, so it stays
//      OFF unless explicitly enabled: `?send=1`, or CHECKOUT_RECOVERY_EMAILS=on.
//      Scheduling this cron without either is therefore safe by default.
//
// `?dryRun=1` reports what both passes would do and changes nothing.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  // Promo mode (operator-triggered, never scheduled): replaces the plain nudge
  // with the Founders offer — pay $9.99, months 2-4 free via a Stripe coupon
  // the webhook attaches after the first paid invoice, $9.99/mo from month 5.
  // Only Founding-Monthly-eligible orders qualify (isFoundersPromoEligible).
  const promo = searchParams.get('promo') === FOUNDERS_PROMO.id ? FOUNDERS_PROMO.id : null
  // Operator-supplied exclusions (comma-separated emails), e.g. a business the
  // operator wants handled personally.
  const excludeParam = (searchParams.get('exclude') || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'))
  const sendEmails =
    !dryRun &&
    (searchParams.get('send') === '1' || process.env.CHECKOUT_RECOVERY_EMAILS === 'on')
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 200, 500))

  try {
    // Unpaid orders only. `payment_status` is 'pending' until the webhook
    // confirms payment, so this can never touch a paying customer.
    const snap = await adminDb
      .collection('sales_orders')
      .where('payment_status', '==', 'pending')
      .limit(limit)
      .get()

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    const now = new Date()

    // Customers who already converted on ANY order must never get a "your
    // link expired" nudge — the pending-only query above cannot see their
    // paid sibling, so fetch converted contacts separately.
    const paidSnap = await adminDb
      .collection('sales_orders')
      .where('payment_status', '==', 'paid')
      .limit(500)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const excludeEmails = paidSnap.docs
      .map((d) => (d.data() as any).contact_email)
      .filter((e: any) => typeof e === 'string' && e.includes('@'))

    const { toExpire, toEmail: recoverable } = planRecovery(orders, now, {
      excludeEmails: [...excludeEmails, ...excludeParam],
    })
    // Promo mode narrows to orders whose product matches the offer's terms.
    const toEmail = promo ? recoverable.filter((o) => isFoundersPromoEligible(o)) : recoverable

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        scanned: orders.length,
        would_mark_expired: toExpire.length,
        would_email: toEmail.length,
        excluded_converted: excludeEmails.length,
        excluded_by_operator: excludeParam,
        promo: promo || null,
        emails_enabled: Boolean(process.env.CHECKOUT_RECOVERY_EMAILS === 'on'),
        recipients: toEmail.map((o) => ({
          id: o.id,
          business: o.business_name || null,
          email: o.contact_email || null,
          product: o.product_id || null,
        })),
      })
    }

    const nowIso = now.toISOString()

    // Pass 1 — tell the truth internally.
    for (const id of toExpire) {
      await adminDb
        .collection('sales_orders')
        .doc(id)
        .set({ checkout_status: 'expired', checkout_expired_marked_at: nowIso }, { merge: true })
        .catch(() => {})
    }

    // Pass 2 — contact the customer, only when explicitly enabled.
    let emailed = 0
    let failed = 0
    if (sendEmails) {
      const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
      for (const order of toEmail) {
        const product = getSalesProduct(order.product_id)
        let subject: string
        let html: string
        if (promo) {
          // Long-lived signed link to OUR redirect route (a raw Stripe session
          // dies in 24h — the exact failure that stranded these leads before).
          const access = createSalesOrderAccess()
          await adminDb.collection('sales_orders').doc(order.id).set(
            {
              promo_token_hash: access.tokenHash,
              promo_token_expires_at: new Date(Date.now() + FOUNDERS_PROMO.tokenDays * 86400000).toISOString(),
              promo_offered: FOUNDERS_PROMO.id,
              promo_offer_sent_at: nowIso,
            },
            { merge: true }
          )
          const offer = foundersOfferEmail({
            businessName: order.business_name,
            offerUrl: `${appOrigin}/api/promo/founders/${order.id}?t=${encodeURIComponent(access.token)}`,
            locale: order.locale,
            priceLabel: getSalesProduct(order.product_id)?.priceLabel,
          })
          subject = offer.subject
          html = offer.html
        } else {
          const plain = recoveryEmail({
            businessName: order.business_name,
            productName: product?.name || order.product_id,
            locale: order.locale,
            replyTo: process.env.ALERT_EMAIL,
          })
          subject = plain.subject
          html = plain.html
        }
        const result = await sendEmail(String(order.contact_email), subject, html)
        // Stamp only on a real send, so a provider outage doesn't silently burn
        // the single nudge this customer is allowed.
        if (result.sent) {
          emailed++
          await adminDb
            .collection('sales_orders')
            .doc(order.id)
            .set({ recovery_emailed_at: nowIso }, { merge: true })
            .catch(() => {})
        } else {
          failed++
        }
      }
    }

    await reportSuccess('cron:checkout-recovery')
    return NextResponse.json({
      scanned: orders.length,
      marked_expired: toExpire.length,
      emails_enabled: sendEmails,
      promo: promo || null,
      eligible_for_email: toEmail.length,
      emailed,
      email_failed: failed,
    })
  } catch (error) {
    await reportFailure('cron:checkout-recovery', error)
    return NextResponse.json({ error: 'Checkout recovery run failed' }, { status: 500 })
  }
}
