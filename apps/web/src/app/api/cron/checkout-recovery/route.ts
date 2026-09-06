import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { getSalesProduct } from '@/lib/sales-products'
import { planRecovery, recoveryEmail } from '@/lib/checkout-recovery'
import { FOUNDERS_PROMO, foundersOfferEmail, isFoundersPromoEligible } from '@/lib/promo'
import { createSalesOrderAccess } from '@/lib/sales-orders'
import { reportFailure, reportSuccess } from '@/lib/alerts'
import { isSuppressed } from '@/lib/suppression'
import { mintUnsubToken, normalizeNewsletterEmail } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// CAN-SPAM §7704(a)(5)(A)(iii): a commercial message must carry a valid physical
// postal address. Same env var every other CityBeat marketing footer reads, so
// the operator sets the address in exactly one place.
const POSTAL_ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Mint (or re-use) the unsubscribe bearer for this order's recovery email.
 *
 * `/api/track/unsub?r=<token>` resolves a `recovery_outreach` doc by its RANDOM
 * `unsub_token` field — never by doc id, because ids here are deterministic and
 * derivable from public data — and writes the address to the global suppression
 * list. The token is reused when one already exists so that an unsubscribe link
 * already sitting in someone's inbox keeps working after a retry; the write is a
 * merge so it can never clobber a `status: 'unsubscribed'` the unsub route set.
 *
 * Returns null if the record cannot be persisted. The caller must then NOT send:
 * a commercial email whose unsubscribe link resolves to nothing is precisely the
 * §7704(a)(3) failure this code exists to prevent.
 */
async function ensureUnsubToken(orderId: string, email: string, nowIso: string): Promise<string | null> {
  try {
    const ref = adminDb.collection('recovery_outreach').doc(`checkout:${orderId}`)
    const existing = await ref.get()
    const prior = existing.exists ? (existing.data() as Record<string, unknown>).unsub_token : null
    const token = typeof prior === 'string' && /^[a-f0-9]{24,64}$/i.test(prior) ? prior : randomBytes(16).toString('hex')
    await ref.set(
      { kind: 'checkout_recovery', order_id: orderId, email, unsub_token: token, last_email_at: nowIso },
      { merge: true }
    )
    return token
  } catch {
    return null
  }
}

/**
 * The CAN-SPAM footer. The recovery bodies (`recoveryEmail`, `foundersOfferEmail`)
 * carry no opt-out and no postal address of their own — the promo one is pure
 * advertising — so the footer is appended here, at the single point where this
 * cron actually sends, rather than trusted to each template.
 *
 * Stacked EN+ES when the order has no locale, matching how the promo body itself
 * stacks: a recipient must be able to read the opt-out in their own language.
 */
function complianceFooter(input: { unsubToken: string; email: string; locale: unknown }): string {
  const url = `${APP_ORIGIN}/api/track/unsub?r=${encodeURIComponent(input.unsubToken)}`
  // 'en' → English only, 'es' → Spanish only, anything else (unset locale) → both.
  const showEn = input.locale !== 'es'
  const showEs = input.locale !== 'en'
  const en = `You are receiving this because you asked CityBeat for a payment link for your business. <a href="${url}" style="color:#777">Unsubscribe</a> to stop these emails.`
  const es = `Recibes esto porque solicitaste a CityBeat un enlace de pago para tu negocio. <a href="${url}" style="color:#777">Cancelar suscripción</a> para no recibir más correos.`
  const lines = [showEn ? en : '', showEs ? es : ''].filter(Boolean).join('<br>')
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:540px;margin-top:26px;padding-top:12px;border-top:1px solid #eee;font-size:11px;color:#777;line-height:1.5">
${lines}<br>
${esc(POSTAL_ADDRESS)}<br>
<span style="color:#999">${esc(input.email)}</span>
</div>`
}

/**
 * RFC 8058 one-click unsubscribe headers, required by the Gmail/Yahoo bulk
 * sender rules. The URL must accept POST: `/api/track/unsub` is GET-only, so the
 * header points at `/api/newsletter/unsubscribe`, which exports POST and
 * suppresses by opaque hash — and `isSuppressed` reads BOTH suppression stores,
 * so a mailbox provider's one-click silences this stream too. The visible footer
 * link stays on the outreach route, whose confirmation page says the right thing
 * to a human.
 */
function unsubHeaders(email: string, locale: unknown): Record<string, string> {
  const token = mintUnsubToken(normalizeNewsletterEmail(email))
  const url = `${APP_ORIGIN}/api/newsletter/unsubscribe?u=${encodeURIComponent(token)}${locale === 'es' ? '&l=es' : ''}`
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
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
// The nudge is a commercial message and is treated as one: the suppression list
// is consulted before every send (it was not, so an address that had already
// unsubscribed could be mailed a promo for up to RECOVERY_WINDOW_DAYS), and each
// message carries a working opt-out link, the physical postal address, and RFC
// 8058 one-click headers. None of that lives in the email templates — it is
// applied here, at the send, so it cannot be forgotten by a new template.
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
    const candidates = promo ? recoverable.filter((o) => isFoundersPromoEligible(o)) : recoverable

    // A prior unsubscribe outranks every other rule here. `planRecovery` is pure
    // and cannot see the suppression list, so the check happens at the send
    // boundary — and in the dry run too, or the preview would name people we are
    // forbidden to contact. Recovery was the ONE marketing sender that skipped
    // this (sales-agent, upsell, ghost-reports and the unclaimed relay all call
    // isSuppressed), so a business that clicked Unsubscribe on an outreach email
    // could still be mailed a promo up to RECOVERY_WINDOW_DAYS later — after
    // being told in writing that it would receive no further outreach.
    const toEmail: typeof candidates = []
    let suppressedCount = 0
    for (const order of candidates) {
      if (await isSuppressed(String(order.contact_email))) {
        suppressedCount++
        continue
      }
      toEmail.push(order)
    }

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        scanned: orders.length,
        would_mark_expired: toExpire.length,
        would_email: toEmail.length,
        excluded_converted: excludeEmails.length,
        excluded_by_operator: excludeParam,
        excluded_unsubscribed: suppressedCount,
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
      for (const order of toEmail) {
        const contactEmail = String(order.contact_email)
        // Persist the opt-out record BEFORE sending. If this write fails the
        // unsubscribe link in the message would resolve to nothing, so the send
        // is abandoned instead: no working opt-out, no commercial email.
        const unsubToken = await ensureUnsubToken(order.id, contactEmail, nowIso)
        if (!unsubToken) {
          failed++
          continue
        }
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
            offerUrl: `${APP_ORIGIN}/api/promo/founders/${order.id}?t=${encodeURIComponent(access.token)}`,
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
        // The footer (opt-out + postal address) and the one-click headers are
        // added here rather than inside the templates, so no future recovery
        // template can ship without them.
        const body = html + complianceFooter({ unsubToken, email: contactEmail, locale: order.locale })
        const result = await sendEmail(contactEmail, subject, body, undefined, {
          headers: unsubHeaders(contactEmail, order.locale),
        })
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
      excluded_unsubscribed: suppressedCount,
      emailed,
      email_failed: failed,
    })
  } catch (error) {
    await reportFailure('cron:checkout-recovery', error)
    return NextResponse.json({ error: 'Checkout recovery run failed' }, { status: 500 })
  }
}
