import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { activeCompTier } from '@/lib/directory-comp'
import { canAccessPremierOffer, premierOfferOpen, PREMIER_LISTING, PREMIER_PROMO, PREMIER_MONTHLY_CENTS } from '@/lib/premier-promotion'
import { blocksReplacementSubscription } from '@/lib/sales-checkout'
import { foundingOfferAvailable } from '@/lib/sales-founding'
import { createFoundingCheckout } from '@/lib/founding-checkout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

async function context() {
  const user = await getServerUser()
  if (!user) return null
  const ref = adminDb.collection('directory_listings').doc(PREMIER_LISTING)
  const doc = await ref.get()
  const listing = { ...doc.data(), id: PREMIER_LISTING } as Record<string, any>
  return doc.exists && canAccessPremierOffer(listing, user) ? { user, ref, listing } : null
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ offer: null })
  let paid = false
  if (ctx.listing.stripe_subscription_id) {
    const subscription = await adminDb.collection('subscriptions').doc(ctx.listing.stripe_subscription_id).get()
    paid = ['active', 'trialing'].includes(subscription.data()?.status)
  }
  return NextResponse.json({ offer: { listingId: PREMIER_LISTING, name: 'Premier Clinic',
    until: ctx.listing.founders_offer_until, open: premierOfferOpen(ctx.listing), paid,
    owned: ctx.listing.owner_id === ctx.user.id && ctx.listing.claim_status === 'approved',
    monthlyCents: PREMIER_MONTHLY_CENTS, locations: 3 } })
}

export async function POST(request: NextRequest) {
  if (!trustedSignInOrigin(request.headers.get('origin'), APP)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'This private invitation is not available to this account.' }, { status: 403 })
  const limit = await checkRateLimit(`premier-promo:${ctx.user.id}:${getClientIp(request)}`, { max: 12, windowMs: 600000 })
  if (!limit.ok) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  if (!['claim', 'checkout'].includes(body.action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  const locale = body.locale === 'es' ? 'es' : 'en'
  try {
    // Claiming is an explicit customer action, independent of payment. Staff
    // approved this exact recipient; verified inbox control is still mandatory.
    const listing = await adminDb.runTransaction(async tx => {
      const fresh = { ...(await tx.get(ctx.ref)).data(), id: PREMIER_LISTING } as Record<string, any>
      if (!canAccessPremierOffer(fresh, ctx.user)) throw new Error('Invitation changed. Refresh and try again.')
      if (body.action === 'checkout' && !premierOfferOpen(fresh)) throw new Error('This Founders offer has ended. Your Basic listing remains available.')
      const now = new Date().toISOString()
      if (!fresh.owner_id) {
        const patch = { owner_id: ctx.user.id, claim_status: 'approved', ownership_verified: true,
          verification_method: 'staff_invited_verified_email', claimed_at: now, verified_at: now,
          tier: activeCompTier(fresh) || 'basic', updated_at: now }
        tx.set(ctx.ref, patch, { merge: true })
        tx.set(adminDb.collection('profiles').doc(ctx.user.id), { is_advertiser: true }, { merge: true })
        tx.set(adminDb.collection('directory_audit_log').doc(), { actor_id: ctx.user.id, listing_id: PREMIER_LISTING, action: 'accepted_staff_promotion_invite', created_at: now })
        return { ...fresh, ...patch }
      }
      if (fresh.claim_status !== 'approved') throw new Error('Your ownership claim is still being reviewed.')
      return fresh
    })
    if (body.action === 'claim') return NextResponse.json({ ok: true, url: `/${locale}/dashboard/listings/${PREMIER_LISTING}` })
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Checkout is temporarily unavailable.')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' })
    if (listing.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(listing.stripe_subscription_id)
      if (blocksReplacementSubscription(existing.status)) return NextResponse.json({ error: 'A subscription already exists. Use Billing to manage it.', url: `/${locale}/billing` }, { status: 409 })
    }
    let expiredSession: string | null = null
    if (listing.promo_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(listing.promo_checkout_session_id)
      if (existing.status === 'open' && existing.url) return NextResponse.json({ url: existing.url })
      if (existing.status === 'complete') return NextResponse.json({ error: 'Payment is being confirmed. Return to your dashboard.' }, { status: 409 })
      expiredSession = existing.id
    }
    if (!(await foundingOfferAvailable())) return NextResponse.json({ error: 'The Founders offer is limited to the first 100 businesses and is currently unavailable. Your Basic listing remains yours.' }, { status: 409 })
    const attempt = await adminDb.runTransaction(async tx => {
      const fresh = { ...(await tx.get(ctx.ref)).data(), id: PREMIER_LISTING } as Record<string, any>
      if (!canAccessPremierOffer(fresh, ctx.user) || fresh.owner_id !== ctx.user.id || !premierOfferOpen(fresh)) throw new Error('Invitation changed. Refresh your dashboard.')
      // Stable idempotency survives retries/network failures; rotate only after
      // Stripe confirms a previous checkout expired without payment.
      if (!fresh.promo_checkout_attempt || (expiredSession && fresh.promo_checkout_session_id === expiredSession)) {
        const id = randomUUID()
        const expires = Math.floor(Math.min(Date.now() + 23 * 3600000, Date.parse(fresh.founders_offer_until)) / 1000)
        if (expires < Math.ceil(Date.now() / 1000) + 1800) throw new Error('New checkout sessions close 30 minutes before the offer ends. Your Basic listing remains available.')
        tx.set(ctx.ref, { promo_checkout_attempt: id, promo_checkout_session_id: null, promo_checkout_locale: locale, promo_checkout_expires: expires }, { merge: true })
        return { id, locale, expires }
      }
      return { id: String(fresh.promo_checkout_attempt), locale: fresh.promo_checkout_locale === 'es' ? 'es' : 'en', expires: Number(fresh.promo_checkout_expires) }
    })
    const metadata = { listing_id: PREMIER_LISTING, owner_id: ctx.user.id, plan: 'founding', tier: 'premium',
      founding: 'true', sponsored: 'false', location_count: '3', billing_quantity: '1', billing_cycle: 'month', promo_id: PREMIER_PROMO }
    const session = await createFoundingCheckout(stripe, PREMIER_LISTING, {
      mode: 'subscription', payment_method_types: ['card'], customer_email: ctx.user.email,
      line_items: [{ price_data: { currency: 'usd', unit_amount: PREMIER_MONTHLY_CENTS, recurring: { interval: 'month' },
        product_data: { name: 'Premier Clinic — CityBeat Founders Premium', description: 'Founders is limited to the first 100 businesses. Regular Premium: $19.99/month per location. Premier special: $9.99/month TOTAL for all three locations, locked while subscribed. Renews monthly until canceled from Billing.' } }, quantity: 1 }],
      success_url: `${APP}/${attempt.locale}/dashboard?premier_checkout=success`, cancel_url: `${APP}/${attempt.locale}/dashboard?premier_checkout=cancelled`,
      expires_at: attempt.expires,
      metadata, subscription_data: { metadata },
      custom_text: { submit: { message: 'First payment: $9.99 today. Renews at $9.99/month total for all three locations until canceled. Cancel from Billing in your CityBeat dashboard.' } },
    })
    await ctx.ref.set({ promo_checkout_session_id: session.id }, { merge: true })
    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    return NextResponse.json({ error: error?.type?.startsWith('Stripe') ? 'Checkout is temporarily unavailable. Please try again.' : error?.message || 'Could not open checkout.' }, { status: 409 })
  }
}
