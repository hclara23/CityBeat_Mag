import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPlan } from '@/lib/pricing'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { blocksReplacementSubscription, directoryBillingQuantity } from '@/lib/sales-checkout'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The REAL plan-change path. Before this existed, "upgrade" had two failure
// modes and no success mode: the self-serve claim route used to open a SECOND
// Stripe subscription (double-billing the owner forever — nothing in this
// codebase cancels a subscription), and after that was blocked with a 409
// there was simply no way to change plans at all. This modifies the EXISTING
// subscription in place: Stripe prorates the difference on the next invoice,
// the card on file keeps working, and exactly one subscription ever exists.
//
// The tier change applies immediately: the payer already passed ownership
// review when their claim was approved (this route requires owner_id === the
// signed-in user), so there is no fraud window — unlike a first-time claim,
// which stays admin-gated.
export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(`change-plan:ip:${getClientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({}))
    const listingId = typeof body.listingId === 'string' ? body.listingId : ''
    const plan = getPlan(body.plan)
    if (!listingId || !plan) return NextResponse.json({ error: 'listingId and a valid plan are required' }, { status: 400 })

    // Founding is a launch promo for NEW signups; allowing a plan CHANGE into
    // it would bypass the Founding-100 cap and its counter.
    if (plan.founding) {
      return NextResponse.json(
        { error: 'The Founding launch price applies to new signups only and cannot be switched into.' },
        { status: 400 }
      )
    }

    const doc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!doc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    const listing = { id: doc.id, ...(doc.data() as any) }

    // Only the approved owner can change the plan they are paying for.
    if (listing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the listing owner can change its plan.' }, { status: 403 })
    }
    const subscriptionId = typeof listing.stripe_subscription_id === 'string' ? listing.stripe_subscription_id : ''
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'This listing has no active subscription — use the normal upgrade checkout instead.', code: 'no_subscription' },
        { status: 409 }
      )
    }
    if (listing.plan === plan.id) {
      return NextResponse.json({ error: 'This listing is already on that plan.' }, { status: 409 })
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (!blocksReplacementSubscription(subscription.status)) {
      return NextResponse.json(
        { error: 'The existing subscription is no longer active — start a new checkout instead.', code: 'subscription_inactive' },
        { status: 409 }
      )
    }
    const item = subscription.items.data[0]
    if (!item) return NextResponse.json({ error: 'Subscription has no billable item.' }, { status: 500 })

    const quantity = directoryBillingQuantity({
      productFamily: 'directory',
      billing: 'subscription',
      listing,
    })

    // Swap the price ON the existing subscription. Subscription-item price_data
    // needs a Product ID (unlike checkout's inline product_data) — reuse the
    // one the original checkout created, so Stripe's dashboard keeps one
    // product history per listing. Proration bills/credits the difference on
    // the next invoice automatically.
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: item.id,
          quantity,
          price_data: {
            currency: 'usd',
            product: typeof item.price.product === 'string' ? item.price.product : item.price.product.id,
            unit_amount: plan.unitAmount,
            recurring: { interval: plan.interval },
          },
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: { ...(subscription.metadata || {}), plan: plan.id, tier: plan.tier },
    })

    const now = new Date().toISOString()
    const sponsoredPatch = plan.sponsored
      ? { is_sponsored: true, sponsored_since: listing.sponsored_since || now }
      : listing.is_sponsored && !plan.sponsored
        ? // Moving OFF the sponsored plan surrenders the sponsored grid slot.
          { is_sponsored: false, pending_sponsored: null }
        : {}
    await doc.ref.set(
      {
        tier: plan.tier,
        plan: plan.id,
        pending_tier: null,
        billing_cycle: plan.interval,
        ...sponsoredPatch,
        updated_at: now,
      },
      { merge: true }
    )
    await adminDb.collection('subscriptions').doc(subscriptionId).set(
      { plan_id: plan.id, billing_cycle: plan.interval, price_per_month: plan.unitAmount, updated_at: now },
      { merge: true }
    )

    return NextResponse.json({
      changed: true,
      plan: plan.id,
      tier: plan.tier,
      quantity,
      note: 'Stripe prorates the difference on your next invoice.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not change the plan' }, { status: 500 })
  }
}
