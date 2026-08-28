import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPlan, FOUNDING_LIMIT } from '@/lib/pricing'
import { REFERRAL_COOKIE } from '@/lib/referrals'
import { resolveReferralForCheckout } from '@/lib/referrals-server'
import { salesDirectoryCheckoutIsManaged } from '@/lib/sales-directory'
import { blocksReplacementSubscription } from '@/lib/sales-checkout'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })

  try {
    const body = await request.json()
    const listingId = body.listingId
    if (!listingId) {
      return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
    }

    // Default to standard monthly Premium when no plan is specified.
    const plan = getPlan(body.plan) || getPlan('premium_monthly')!

    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sales-rep commission attribution: a staff member (sales/editor/developer)
    // closing a deal can attribute the payout to a rep via `payout_user_id`.
    // Ignored for self-serve advertisers so they can't redirect payouts to
    // themselves. The webhook only pays out if a percent is configured.
    let payoutUserId: string | undefined
    if (typeof body.payout_user_id === 'string' && body.payout_user_id) {
      const callerProfile = await getServerUserProfile(user.id)
      if (hasSalesAccess(callerProfile)) payoutUserId = body.payout_user_id
    }

    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const listing = { id: doc.id, ...(doc.data() as any) }

    // Sales Desk listings already have one authoritative handoff for their
    // selected price. Claiming verifies ownership only; it must never open a
    // second subscription checkout.
    if (salesDirectoryCheckoutIsManaged(listing)) {
      return NextResponse.json(
        {
          error:
            'This listing plan is managed by the CityBeat Sales Desk. Use the payment link supplied by your salesperson.',
        },
        { status: 409 }
      )
    }

    // A listing that already carries a LIVE Stripe subscription must never open a
    // second one. Nothing in this codebase cancels a subscription (the only
    // Stripe cancel-shaped call anywhere is deleteDiscount), so a second
    // checkout leaves the first billing forever, unreachable from the customer
    // portal — the owner is simply charged twice every month. This is reachable
    // from the dashboard "boost" button, which posts here for a listing the user
    // already owns, and even from re-selecting the plan they are already on.
    // The Sales Desk path has always refused this (blocksReplacementSubscription
    // in api/sales/checkout); the self-serve path never did.
    if (listing.stripe_subscription_id) {
      let subscriptionIsLive = true
      try {
        const existing = await stripe.subscriptions.retrieve(String(listing.stripe_subscription_id))
        subscriptionIsLive = blocksReplacementSubscription(existing.status)
      } catch (error: any) {
        // A subscription Stripe cannot find is genuinely gone — let the customer
        // buy again rather than locking them out on a lookup failure.
        if (error?.code === 'resource_missing' || error?.statusCode === 404) subscriptionIsLive = false
      }
      if (subscriptionIsLive) {
        return NextResponse.json(
          {
            error:
              'This listing already has an active subscription. Manage or change your plan from Billing so you are not charged twice.',
            code: 'subscription_already_exists',
            manage_url: '/billing',
          },
          { status: 409 }
        )
      }
    }

    // Block claiming a listing another account already owns or is mid-claim on.
    // Without the `pending_approval` case, a second payer could check out for the
    // same listing while the first is awaiting approval; the webhook would then
    // clobber `owner_id`, charging the first payer for a listing they lose.
    if (
      (listing.claim_status === 'approved' || listing.claim_status === 'pending_approval') &&
      listing.owner_id &&
      listing.owner_id !== user.id
    ) {
      return NextResponse.json(
        { error: 'This listing is already being claimed by another account.' },
        { status: 409 }
      )
    }

    // Founding 100: enforce the launch-promo cap server-side.
    if (plan.founding) {
      const count = await adminDb
        .collection('directory_listings')
        .where('founding_member', '==', true)
        .count()
        .get()
        .then((s: any) => s.data().count)
        .catch(() => 0)
      if (count >= FOUNDING_LIMIT) {
        return NextResponse.json(
          { error: 'The Founding 100 launch offer is sold out. Please choose another plan.', founding_sold_out: true },
          { status: 409 }
        )
      }
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin

    // Multi-location brands are billed PER LOCATION: the plan fee is multiplied
    // by the number of locations consolidated under this listing.
    const locationCount = Math.max(1, Number(listing.location_count) || 1)
    const perLocationNote =
      locationCount > 1 ? ` — ${locationCount} locations × ${plan.priceLabel}` : ''

    // The public code can arrive from the server cookie or the 30-day browser
    // fallback (Firebase Hosting may strip non-session cookies). It is always
    // validated against Firestore and is accepted only for a first paid checkout.
    const referral = !listing.stripe_subscription_id
      ? await resolveReferralForCheckout({
          code: body.referral_code || request.cookies.get(REFERRAL_COOKIE)?.value,
          referredListingId: listing.id,
          referredOwnerId: user.id,
          referredEmail: user.email,
        })
      : null
    const checkoutMetadata: Record<string, string> = {
      listing_id: listing.id,
      owner_id: user.id,
      plan: plan.id,
      tier: plan.tier,
      founding: plan.founding ? 'true' : 'false',
      sponsored: plan.sponsored ? 'true' : 'false',
      location_count: String(locationCount),
      billing_cycle: plan.interval,
      ...(payoutUserId ? { payout_user_id: payoutUserId } : {}),
      ...(referral
        ? {
            referral_code: referral.code,
            referrer_listing_id: referral.referrer_listing_id,
          }
        : {}),
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: plan.unitAmount,
            recurring: { interval: plan.interval },
            product_data: {
              name: `CityBeat Directory ${plan.label}: ${listing.name}${perLocationNote}`,
              description: plan.description,
            },
          },
          quantity: locationCount,
        },
      ],
      success_url: `${origin}/directory/${listing.id}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/directory/${listing.id}?status=cancel`,
      metadata: checkoutMetadata,
      // Stripe copies these identifiers onto the subscription and invoices so
      // finance attribution does not depend on webhook delivery order.
      subscription_data: { metadata: checkoutMetadata },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Error creating claim checkout session:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
