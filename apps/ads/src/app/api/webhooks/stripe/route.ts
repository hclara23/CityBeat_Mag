import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { syncCampaignBanner } from '@/lib/banner-sync'

export const dynamic = 'force-dynamic'

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? ''
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-08-16',
})

export async function POST(req: NextRequest) {
  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const campaignId = session.metadata?.campaign_id
  const listingId = session.metadata?.listing_id
  const ownerId = session.metadata?.owner_id
  const paymentIntentId = session.payment_intent?.toString()

  if (listingId && ownerId) {
    try {
      // set(merge) — never throws if the listing doc is somehow missing, and won't
      // clobber fields written by the web webhook for the same event.
      await adminDb.collection('directory_listings').doc(listingId).set({
        owner_id: ownerId,
        claim_status: 'pending_approval',
        pending_tier: session.metadata?.tier === 'featured' ? 'featured' : 'premium',
        stripe_subscription_id: session.subscription || null,
        stripe_customer_id: session.customer || null,
        claimed_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })

      return NextResponse.json({ received: true, listing_id: listingId, new_status: 'pending_approval' })
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id or listing_id' }, { status: 400 })
  }

  try {
    await adminDb.collection('ad_campaigns').doc(campaignId).update({
      status: 'active',
      is_active: true,
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntentId ?? null,
      // Recurring ad subscriptions store their sub id so the web webhook can pause
      // the campaign if a renewal fails or it's cancelled.
      stripe_subscription_id: session.subscription || null,
      updated_at: FieldValue.serverTimestamp()
    })

    // A paid banner campaign goes live automatically.
    await syncCampaignBanner(campaignId, { active: true }).catch(() => {})

    return NextResponse.json({ received: true, campaign_id: campaignId, new_status: 'active' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
