import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { payoutToUser } from '@/lib/payouts'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
})

export const dynamic = 'force-dynamic'

// ---- helpers ----------------------------------------------------------------

async function findOne(collection: string, field: string, value: string) {
  if (!value) return null
  const snap = await adminDb.collection(collection).where(field, '==', value).limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

async function setPaymentStatusByField(field: string, value: string, status: string) {
  if (!value) return
  const snap = await adminDb.collection('ad_purchases').where(field, '==', value).get()
  const now = new Date().toISOString()
  await Promise.all(snap.docs.map((d) => d.ref.set({ payment_status: status, updated_at: now }, { merge: true })))
}

// ---- event handlers (all write Firestore) -----------------------------------

async function handleCheckoutCompleted(session: any) {
  const metadata = session.metadata || {}

  // 1. Directory premium claim → mark listing pending admin approval.
  if (metadata.listing_id && metadata.owner_id) {
    // Tier the admin will grant on approval (premium/featured). Founding members
    // get Premium at the locked launch price and are flagged for the 100 cap.
    const pendingTier = metadata.tier === 'featured' ? 'featured' : 'premium'
    await adminDb.collection('directory_listings').doc(metadata.listing_id).set(
      {
        owner_id: metadata.owner_id,
        claim_status: 'pending_approval',
        pending_tier: pendingTier,
        plan: metadata.plan || 'premium_monthly',
        founding_member: metadata.founding === 'true',
        stripe_subscription_id: session.subscription || null,
        stripe_customer_id: session.customer || null,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
    // Pay out the configured share (e.g. to a referrer/sales rep set via
    // metadata.payout_user_id, otherwise the owner). No-ops if percent is 0.
    await payoutToUser({
      stripe,
      payeeUserId: metadata.payout_user_id || metadata.owner_id,
      service: 'directory',
      amountTotal: session.amount_total,
      currency: session.currency || 'usd',
      sourcePaymentId: session.id,
    })
    return
  }

  // 2. Job / ad-campaign provisioning (metadata may live on the line item price).
  let provisionMeta = metadata
  if (!provisionMeta.productId) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
      provisionMeta = lineItems.data[0]?.price?.metadata || metadata
    } catch {
      /* ignore */
    }
  }
  if (provisionMeta.productId && provisionMeta.type) {
    const now = new Date().toISOString()
    if (provisionMeta.type === 'job') {
      const expires = new Date(Date.now() + 30 * 86400000).toISOString()
      await adminDb.collection('jobs').doc(provisionMeta.productId).set(
        { is_active: true, is_paid: true, status: 'published', payment_status: 'paid', published_at: now, expires_at: expires }, { merge: true }
      )
    } else if (provisionMeta.type === 'ad_campaign') {
      await adminDb.collection('campaigns').doc(provisionMeta.productId).set(
        { is_active: true, status: 'running', payment_status: 'paid', published_at: now }, { merge: true }
      )
    }
    return
  }

  // 3. Generic advertiser purchase → record ad_purchases + payments.
  const advertiserEmail = session.customer_email || session.customer_details?.email || null
  await adminDb.collection('ad_purchases').add({
    session_id: session.id,
    campaign_id: metadata.campaignId || null,
    advertiser_id: metadata.advertiserId || null,
    advertiser_email: advertiserEmail,
    company_name: metadata.companyName || null,
    ad_type: metadata.adType || 'advertisement',
    billing_cycle: metadata.billingCycle || null,
    amount_total: session.amount_total || 0,
    currency: session.currency || 'usd',
    payment_status: 'completed',
    stripe_customer_id: session.customer || null,
    stripe_subscription_id: session.subscription || null,
    stripe_payment_intent_id: session.payment_intent || null,
    created_at: FieldValue.serverTimestamp(),
  })
  if (metadata.campaignId) {
    await adminDb.collection('campaigns').doc(metadata.campaignId).set(
      { status: 'active', updated_at: new Date().toISOString() }, { merge: true }
    )
  }

  // Pay out the configured share to the attributed creator/user, if any.
  await payoutToUser({
    stripe,
    payeeUserId: metadata.payout_user_id || metadata.advertiserId || null,
    service: metadata.adType === 'sponsored_post' ? 'sponsored_post' : 'ad_campaign',
    amountTotal: session.amount_total,
    currency: session.currency || 'usd',
    sourcePaymentId: session.id,
  })
}

async function handleChargeRefunded(charge: any) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : ''
  const doc = (await findOne('ad_purchases', 'stripe_payment_intent_id', pi)) || (await findOne('ad_purchases', 'session_id', charge.id))
  if (doc) {
    await doc.ref.set({ payment_status: 'refunded', updated_at: new Date().toISOString() }, { merge: true })
  }
  // If the refund corresponds to a directory premium subscription, downgrade the listing.
  if (charge.customer) {
    const listing = await findOne('directory_listings', 'stripe_customer_id', charge.customer)
    if (listing) {
      await listing.ref.set({ tier: 'basic', updated_at: new Date().toISOString() }, { merge: true })
    }
  }
}

async function recordPayment(invoice: any) {
  await adminDb.collection('payments').doc(invoice.id).set(
    {
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer || null,
      stripe_subscription_id: invoice.subscription || null,
      advertiser_email: invoice.customer_email || null,
      amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
      currency: invoice.currency || 'usd',
      status: invoice.status || 'paid',
      invoice_pdf: invoice.invoice_pdf || null,
      created_at: new Date(((invoice.created || Date.now() / 1000) as number) * 1000).toISOString(),
    },
    { merge: true }
  )
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  await recordPayment({ ...invoice, status: 'paid' })
  await setPaymentStatusByField('stripe_customer_id', invoice.customer || '', 'completed')
  if (invoice.subscription) {
    await adminDb.collection('subscriptions').doc(invoice.subscription).set(
      { status: 'active', stripe_customer_id: invoice.customer || null, updated_at: new Date().toISOString() }, { merge: true }
    )
  }
}

async function handleInvoicePaymentFailed(invoice: any) {
  await recordPayment({ ...invoice, status: 'payment_failed' })
  await setPaymentStatusByField('stripe_customer_id', invoice.customer || '', 'past_due')
  if (invoice.subscription) {
    await adminDb.collection('subscriptions').doc(invoice.subscription).set(
      { status: 'past_due', updated_at: new Date().toISOString() }, { merge: true }
    )
  }
}

async function upsertSubscription(subscription: any, status?: string) {
  // Try to attribute the subscription to an advertiser via an existing purchase.
  const purchase = await findOne('ad_purchases', 'stripe_customer_id', subscription.customer || '')
  await adminDb.collection('subscriptions').doc(subscription.id).set(
    {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer || null,
      advertiser_id: (purchase?.data() as any)?.advertiser_id || null,
      status: status || subscription.status || 'active',
      price_per_month: subscription.items?.data?.[0]?.price?.unit_amount ?? null,
      billing_cycle: subscription.items?.data?.[0]?.price?.recurring?.interval || 'month',
      created_at: new Date(((subscription.created || Date.now() / 1000) as number) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
}

async function handleSubscriptionCreated(subscription: any) {
  await upsertSubscription(subscription)
  if (subscription.customer) {
    const snap = await adminDb.collection('ad_purchases').where('stripe_customer_id', '==', subscription.customer).get()
    const status = subscription.status === 'active' ? 'completed' : 'pending'
    await Promise.all(
      snap.docs.map((d) => d.ref.set({ stripe_subscription_id: subscription.id, payment_status: status, updated_at: new Date().toISOString() }, { merge: true }))
    )
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  await upsertSubscription(subscription)
}

async function handleSubscriptionDeleted(subscription: any) {
  await upsertSubscription(subscription, 'canceled')
  await setPaymentStatusByField('stripe_subscription_id', subscription.id, 'cancelled')
  // Downgrade any directory listing tied to this subscription.
  const listing = await findOne('directory_listings', 'stripe_subscription_id', subscription.id)
  if (listing) {
    await listing.ref.set({ tier: 'basic', updated_at: new Date().toISOString() }, { merge: true })
  }
}

// ---- entry point ------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') as string

  let event: Stripe.Event
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      event = JSON.parse(body)
    }
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed.', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    const obj: any = event.data.object
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(obj)
        break
      case 'charge.refunded':
        await handleChargeRefunded(obj)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(obj)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(obj)
        break
      case 'customer.subscription.created':
        await handleSubscriptionCreated(obj)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(obj)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(obj)
        break
      default:
        break
    }
  } catch (e: any) {
    console.error(`Failed to process ${event.type}:`, e)
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
