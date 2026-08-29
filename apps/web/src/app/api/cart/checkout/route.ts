import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import Stripe from 'stripe'
import { planCart, toStripeLineItems, isSelfServeCartEligible, type CartItem } from '@/lib/cart'
import { getSalesProduct } from '@/lib/sales-products'
import { buildSalesOrderRecord, createSalesOrderAccess } from '@/lib/sales-orders'
import { recurringCheckoutDefaults, oneTimeCheckoutDefaults } from '@/lib/sales-checkout'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// Self-serve multi-item checkout: turns a basket into ONE Stripe Checkout session
// (payment or subscription per lib/cart planCart) over N sales_orders, so the
// customer pays once for several products. Self-serve → NO rep, NO commission
// (sold_by/payout_user_id are null), so it never touches the commission/clawback
// paths. Each order rides the existing awaiting_intake → Fulfillment Queue →
// /fulfill flow; all orders share ONE access token so a single link reaches every
// brief. Directory listings are excluded (they use the per-listing Claim flow).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`cart-checkout:ip:${ip}`, { max: 12, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts — please wait a moment.' }, { status: 429 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })

  const body = await req.json().catch(() => ({}))
  const items: CartItem[] = (Array.isArray(body.items) ? body.items : [])
    .map((it: any) => ({ productId: String(it?.productId || ''), customAmount: it?.customAmount }))
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : ''
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 160) : ''
  const locale: 'en' | 'es' = body.locale === 'es' ? 'es' : 'en'

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'A valid contact email is required.' }, { status: 400 })
  }

  // Two families are barred from the self-serve cart:
  //  • directory — needs the per-listing Claim flow (it attaches to a listing).
  //  • custom — a rep-quoted "name your price" line; letting it self-serve would
  //    allow a buyer to conjure a $0.01 "custom" order (queue spam / mispricing).
  //    Custom work stays behind a rep via /admin/sales/new.
  for (const it of items) {
    const p = getSalesProduct(it.productId)
    if (p && p.family === 'directory') {
      return NextResponse.json(
        { error: 'Directory listings are purchased from the listing’s Claim page, not the cart.', code: 'directory_not_in_cart' },
        { status: 400 }
      )
    }
    if (p && p.family === 'custom') {
      return NextResponse.json(
        { error: 'Custom quotes are arranged with a CityBeat rep, not the self-serve cart.', code: 'custom_not_in_cart' },
        { status: 400 }
      )
    }
    // Final catch-all guard (free / anything else non-eligible) — the specific
    // cases above give friendlier codes; this closes the rest.
    if (!isSelfServeCartEligible(p)) {
      return NextResponse.json(
        { error: 'One or more items can’t be purchased from the cart.', code: 'not_cart_eligible' },
        { status: 400 }
      )
    }
  }

  const plan = planCart(items)
  if (!plan.ok) {
    const msg =
      plan.reason === 'mixed_recurring_intervals'
        ? 'A monthly and an annual plan can’t be combined into one payment — please check those out separately.'
        : plan.reason === 'empty_cart'
          ? 'Your cart is empty.'
          : plan.reason === 'too_many_items'
            ? 'That’s too many items for one order.'
            : 'One or more items in your cart can’t be purchased together.'
    return NextResponse.json({ error: msg, code: plan.reason }, { status: 400 })
  }

  const user = await getServerUser().catch(() => null)
  const now = new Date()
  // ONE shared access token for the whole basket → a single link reaches every
  // order's status + intake brief.
  const access = createSalesOrderAccess()

  const orderIds: string[] = []
  try {
    for (const li of plan.lineItems) {
      const product = getSalesProduct(li.productId)!
      const base = buildSalesOrderRecord({
        product,
        amount: li.amount,
        businessName: businessName || contactEmail,
        contactEmail,
        locale,
        sellerUserId: '', // self-serve — nulled below so no commission is attributed
        tokenHash: access.tokenHash,
        now,
      })
      const ref = adminDb.collection('sales_orders').doc()
      await ref.set({
        ...base,
        sold_by: null,
        payout_user_id: null,
        source: 'self_serve_cart',
        cart_purchase: true,
        buyer_user_id: user?.id || null,
        checkout_status: 'pending',
      })
      orderIds.push(ref.id)
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not start checkout.' }, { status: 500 })
  }

  const metadata: Record<string, string> = {
    cart: 'true',
    cart_order_ids: JSON.stringify(orderIds),
    contact_email: contactEmail,
    ...(user?.id ? { buyer_user_id: user.id } : {}),
  }

  const primaryId = orderIds[0]
  const successUrl = `${APP_URL}/${locale}/order/${primaryId}?access=${encodeURIComponent(access.token)}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${APP_URL}/${locale}/ads?cart=cancel`
  const recurringInterval = plan.lineItems.find((l) => l.recurring)?.recurring?.interval || 'month'
  const priceLabel = `$${(plan.total / 100).toFixed(2)}`

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      ...(plan.mode === 'subscription'
        ? recurringCheckoutDefaults(priceLabel, recurringInterval)
        : oneTimeCheckoutDefaults()),
      customer_email: contactEmail,
      client_reference_id: primaryId,
      line_items: toStripeLineItems(plan),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      ...(plan.mode === 'subscription' ? { subscription_data: { metadata } } : {}),
    })
  } catch (error: any) {
    // Stripe never opened — delete the just-created orders so they don't linger as
    // orphaned awaiting-payment rows with no checkout session (nothing was charged).
    await Promise.all(orderIds.map((id) => adminDb.collection('sales_orders').doc(id).delete().catch(() => {}))).catch(() => {})
    return NextResponse.json({ error: error?.message || 'Stripe could not create the checkout.' }, { status: 502 })
  }

  const stamp = {
    stripe_checkout_session_id: session.id,
    checkout_url: session.url,
    checkout_status: 'ready',
    checkout_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  await Promise.all(orderIds.map((id) => adminDb.collection('sales_orders').doc(id).set(stamp, { merge: true }))).catch(() => {})

  return NextResponse.json({ url: session.url, orderIds, count: orderIds.length })
}
