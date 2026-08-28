import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPlan } from '@/lib/pricing'
import { getSalesProduct } from '@/lib/sales-products'
import { FOUNDERS_PROMO, isFoundersPromoEligible } from '@/lib/promo'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { recurringCheckoutDefaults, recurringCustomerParams } from '@/lib/sales-checkout'
import {
  createSalesOrderAccess,
  salesOrderAccessExpired,
  salesOrderAccessExpiresAt,
  salesOrderCheckoutUrls,
  salesOrderStripeMetadata,
  salesOrderTokenMatches,
} from '@/lib/sales-orders'
import { foundingOfferAvailable } from '@/lib/sales-founding'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The Founders-offer landing link. Emails must not contain raw Stripe Checkout
// URLs (sessions die within 24h — exactly the failure that stranded these
// leads the first time), so the email links HERE with a signed token and this
// route mints a FRESH session on every click, then redirects into Stripe.
// The promo itself is carried as session metadata; the webhook applies the
// 3-months-free coupon only after the first invoice is actually paid.
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })

  const rl = await checkRateLimit(`promo:ip:${getClientIp(request)}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  const { orderId } = await params
  const token = request.nextUrl.searchParams.get('t') || ''
  if (!orderId || !token) return NextResponse.json({ error: 'Invalid offer link' }, { status: 400 })

  try {
    const ref = adminDb.collection('sales_orders').doc(orderId)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'This offer link is no longer valid.' }, { status: 404 })
    const order = snap.data() as Record<string, any>

    if (
      !salesOrderTokenMatches(token, order.promo_token_hash) ||
      salesOrderAccessExpired(order.promo_token_expires_at)
    ) {
      return NextResponse.json({ error: 'This offer link has expired. Reply to the offer email for a fresh one.' }, { status: 403 })
    }
    if (!isFoundersPromoEligible(order)) {
      // Most common reason: they already paid. Send them somewhere sensible.
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
      return NextResponse.redirect(`${origin}/${order.locale === 'es' ? 'es' : 'en'}/dashboard`, 302)
    }
    // The Founders offer sells a Founding 100 place — honor the cap.
    if (!(await foundingOfferAvailable())) {
      return NextResponse.json({ error: 'The Founding 100 offer has sold out.' }, { status: 409 })
    }

    const product = getSalesProduct(order.product_id)
    const plan = product?.directoryPlanId ? getPlan(product.directoryPlanId) : null
    if (!product || !plan) return NextResponse.json({ error: 'This offer is no longer available.' }, { status: 409 })

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const locale = order.locale === 'es' ? 'es' : 'en'

    // If a session from an earlier click is STILL LIVE, reuse it. The webhook
    // verifies the paying session against the one stored on the order, so
    // minting a second while the first is open would strand whichever tab the
    // customer actually pays in.
    const existingExpiry = Date.parse(order.checkout_expires_at || '')
    if (
      order.promo === FOUNDERS_PROMO.id &&
      order.checkout_url &&
      Number.isFinite(existingExpiry) &&
      existingExpiry > Date.now() + 60_000
    ) {
      await ref.set({ promo_link_clicked_at: new Date().toISOString() }, { merge: true }).catch(() => {})
      return NextResponse.redirect(String(order.checkout_url), 302)
    }

    // Fresh post-payment wizard access for THIS click (the original token's
    // raw value is unrecoverable — only its hash is stored).
    const access = createSalesOrderAccess()
    const urls = salesOrderCheckoutUrls({
      origin,
      locale,
      orderId,
      token: access.token,
      billing: 'subscription',
    })

    const metadata: Record<string, string> = {
      ...salesOrderStripeMetadata({
        orderId,
        product,
        sellerUserId: order.sold_by || '',
        contactEmail: order.contact_email || '',
        businessName: order.business_name || '',
        listingId: order.listing_id || '',
      }),
      tier: plan.tier,
      plan: plan.id,
      founding: plan.founding ? 'true' : 'false',
      sponsored: plan.sponsored ? 'true' : 'false',
      billing_cycle: plan.interval,
      directory_category: order.directory_category || '',
      listing_preexisting: order.listing_preexisting ? 'true' : 'false',
      // The webhook sees this and applies the 3-months-free coupon AFTER the
      // first invoice is paid — never on the first charge.
      promo: FOUNDERS_PROMO.id,
    }

    const amount = Number(order.amount) || plan.unitAmount
    const session = await stripe.checkout.sessions.create({
      ...recurringCheckoutDefaults(plan.priceLabel, plan.interval),
      ...recurringCustomerParams({
        customerId: undefined,
        listingEmail: order.contact_email,
        contactEmail: order.contact_email || '',
      }),
      client_reference_id: orderId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            recurring: { interval: plan.interval },
            product_data: {
              name: `CityBeat ${product.shortName}: ${order.business_name || 'your business'} — Founders offer: months 2–4 free`,
              description: `${plan.description} Founders offer: pay ${plan.priceLabel} today, months 2–4 free, then ${plan.priceLabel} from month 5. Cancel anytime.`,
            },
          },
        },
      ],
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata,
      subscription_data: { metadata },
    })

    await ref.set(
      {
        checkout_status: 'ready',
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        checkout_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        intake_token_hash: access.tokenHash,
        intake_expires_at: salesOrderAccessExpiresAt(),
        promo: FOUNDERS_PROMO.id,
        promo_link_clicked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )

    return NextResponse.redirect(session.url || `${origin}/${locale}`, 302)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not open the offer' }, { status: 500 })
  }
}
