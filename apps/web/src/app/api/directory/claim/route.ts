import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPlan, FOUNDING_LIMIT } from '@/lib/pricing'
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
      metadata: {
        listing_id: listing.id,
        owner_id: user.id,
        plan: plan.id,
        tier: plan.tier,
        founding: plan.founding ? 'true' : 'false',
        location_count: String(locationCount),
        ...(payoutUserId ? { payout_user_id: payoutUserId } : {}),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Error creating claim checkout session:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
