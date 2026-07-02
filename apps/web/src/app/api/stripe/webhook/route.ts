import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { payoutToUser, getPayoutSettings } from '@/lib/payouts'
import { getPlatformSettings } from '@/lib/platform-settings'

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

  // 0. Paid "feature this event" → publish + feature the event.
  if (metadata.type === 'event_feature' && metadata.event_id) {
    await adminDb.collection('events').doc(metadata.event_id).set(
      { featured: true, status: 'approved', featured_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { merge: true }
    )
    return
  }

  // 1. Directory premium claim → mark listing pending admin approval.
  //    Either a self-serve owner (owner_id) OR a rep-initiated field sale (sold_by,
  //    where the client may not have an account yet — admin attaches the owner on
  //    approval using the captured contact_email).
  if (metadata.listing_id && (metadata.owner_id || metadata.sold_by)) {
    // Tier the admin will grant on approval (premium/featured). Founding members
    // get Premium at the locked launch price and are flagged for the 100 cap.
    const pendingTier = metadata.tier === 'featured' ? 'featured' : 'premium'
    const listingPatch: Record<string, any> = {
      claim_status: 'pending_approval',
      pending_tier: pendingTier,
      plan: metadata.plan || 'premium_monthly',
      founding_member: metadata.founding === 'true',
      stripe_subscription_id: session.subscription || null,
      stripe_customer_id: session.customer || null,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (metadata.owner_id) listingPatch.owner_id = metadata.owner_id
    if (metadata.sold_by) listingPatch.sold_by_rep = metadata.sold_by
    if (metadata.contact_email) listingPatch.contact_email = metadata.contact_email

    // Instant approval (godmode opt-in): a self-serve owner who paid gets approved
    // immediately, skipping manual review. Rep field sales (sold_by, no account)
    // always stay pending so an admin can attach the real owner.
    const settings = await getPlatformSettings()
    if (settings.auto_approve_claims && metadata.owner_id && !metadata.sold_by) {
      listingPatch.claim_status = 'approved'
      listingPatch.tier = pendingTier
      listingPatch.pending_tier = null
      listingPatch.is_advertiser = true
    }

    await adminDb.collection('directory_listings').doc(metadata.listing_id).set(listingPatch, { merge: true })

    // Funnel close: mark any outreach for this listing as converted.
    await markOutreachConverted(metadata.listing_id)
    // Pay out the configured share ONLY to an explicitly attributed payee (e.g. the
    // sales rep set via metadata.payout_user_id at checkout). Never default to the
    // owner — that would refund the payer a cut of their own payment. No-ops if
    // there's no payee or the percent is 0.
    await payoutToUser({
      stripe,
      payeeUserId: metadata.payout_user_id || null,
      service: 'directory',
      amountTotal: session.amount_total,
      currency: session.currency || 'usd',
      sourcePaymentId: session.id,
    })
    // Remember the rep so renewals can pay residual commission (if enabled).
    await recordSubscriptionAttribution(session.subscription, metadata.payout_user_id, 'directory')
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
  //    Key the row on the Stripe session id (idempotent upsert) so a webhook
  //    retry after a partial failure can't create a duplicate ledger row and
  //    double-count revenue in finance reports.
  const advertiserEmail = session.customer_email || session.customer_details?.email || null
  await adminDb.collection('ad_purchases').doc(session.id).set({
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
  }, { merge: true })
  if (metadata.campaignId) {
    await adminDb.collection('campaigns').doc(metadata.campaignId).set(
      { status: 'active', updated_at: new Date().toISOString() }, { merge: true }
    )
  }

  // Pay out the configured share ONLY to an explicitly attributed payee (e.g. the
  // creator/rep set via metadata.payout_user_id). Never default to the advertiser —
  // that would pay the buyer a cut of their own purchase.
  await payoutToUser({
    stripe,
    payeeUserId: metadata.payout_user_id || null,
    service: metadata.adType === 'sponsored_post' ? 'sponsored_post' : 'ad_campaign',
    amountTotal: session.amount_total,
    currency: session.currency || 'usd',
    sourcePaymentId: session.id,
  })
  await recordSubscriptionAttribution(
    session.subscription,
    metadata.payout_user_id,
    metadata.adType === 'sponsored_post' ? 'sponsored_post' : 'ad_campaign'
  )
}

// Funnel close: mark outbound outreach for a listing as converted when it pays.
async function markOutreachConverted(listingId: string) {
  if (!listingId) return
  try {
    const snap = await adminDb.collection('sales_outreach').where('listing_id', '==', listingId).get()
    const now = new Date().toISOString()
    await Promise.all(snap.docs.map((d) => d.ref.set({ status: 'converted', converted_at: now }, { merge: true })))
  } catch {
    /* non-fatal */
  }
}

// Persist who earns commission on a subscription so renewals can pay residuals.
async function recordSubscriptionAttribution(subscriptionId: any, payeeUserId: any, service: string) {
  if (!subscriptionId || !payeeUserId) return
  await adminDb.collection('subscriptions').doc(String(subscriptionId)).set(
    { payout_user_id: payeeUserId, payout_service: service, updated_at: new Date().toISOString() },
    { merge: true }
  )
}

// Residual commission: on a subscription RENEWAL (not the first invoice, which
// checkout.session.completed already paid), pay the attributed rep again — but
// only when godmode has commission_mode = 'residual'. Idempotent per invoice.
async function payResidualCommissionIfDue(invoice: any) {
  if (invoice.billing_reason !== 'subscription_cycle' || !invoice.subscription) return

  const settings = await getPayoutSettings()
  if (settings.commission_mode !== 'residual') return

  const subDoc = await adminDb.collection('subscriptions').doc(String(invoice.subscription)).get()
  const sub = subDoc.exists ? (subDoc.data() as any) : null
  if (!sub?.payout_user_id || !sub.payout_service) return

  // Don't double-pay a renewal on webhook retries.
  const existing = await adminDb.collection('transfers').where('source_payment', '==', invoice.id).limit(1).get()
  if (!existing.empty) return

  await payoutToUser({
    stripe,
    payeeUserId: sub.payout_user_id,
    service: sub.payout_service,
    amountTotal: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency || 'usd',
    sourcePaymentId: invoice.id,
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
  // Pay the rep their residual share on renewals, if godmode enabled it.
  await payResidualCommissionIfDue(invoice)
}

async function handleInvoicePaymentFailed(invoice: any) {
  await recordPayment({ ...invoice, status: 'payment_failed' })
  await setPaymentStatusByField('stripe_customer_id', invoice.customer || '', 'past_due')
  if (invoice.subscription) {
    await adminDb.collection('subscriptions').doc(invoice.subscription).set(
      { status: 'past_due', updated_at: new Date().toISOString() }, { merge: true }
    )
    // An ads-portal banner/sponsored subscription that lapses should stop showing.
    await setAdCampaignsBySubscription(invoice.subscription, { status: 'past_due', is_active: false })
  }
}

// Updates any ads-portal campaigns tied to a Stripe subscription (separate
// `ad_campaigns` collection owned by the ads app). Keeps recurring ad placements
// in sync when a subscription renews-fails or is cancelled.
async function setAdCampaignsBySubscription(subscriptionId: string, patch: Record<string, any>) {
  if (!subscriptionId) return
  const snap = await adminDb.collection('ad_campaigns').where('stripe_subscription_id', '==', subscriptionId).get()
  const now = new Date().toISOString()
  await Promise.all(snap.docs.map((d) => d.ref.set({ ...patch, updated_at: now }, { merge: true })))
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
  // Stop any ads-portal campaigns tied to this subscription.
  await setAdCampaignsBySubscription(subscription.id, { status: 'cancelled', is_active: false })
}

// ---- entry point ------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') as string

  // Fail CLOSED: never process an unsigned event in production. Without signature
  // verification a forged POST could approve listings, publish jobs, or trigger
  // payouts. The unsigned JSON.parse path is allowed only in local dev.
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('STRIPE_WEBHOOK_SECRET is not set — refusing unsigned webhook.')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }
  }

  let event: Stripe.Event
  try {
    event = webhookSecret
      ? stripe.webhooks.constructEvent(body, signature, webhookSecret)
      : JSON.parse(body)
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed.', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // Idempotency: Stripe delivers at-least-once. Skip an event we've already fully
  // processed so retries don't re-run handlers (duplicate ad_purchases, etc.).
  // Per-operation guards (payout idempotency key) cover the partial-failure race.
  const eventRef = adminDb.collection('stripe_events').doc(event.id)
  try {
    const seen = await eventRef.get()
    if (seen.exists) return NextResponse.json({ received: true, deduped: true })
  } catch {
    /* if the check fails, fall through and process (guards below still apply) */
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
    // Don't mark processed — let Stripe retry.
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
  }

  // Mark processed only after success, so a partial failure can still be retried.
  await eventRef
    .set({ type: event.type, processed_at: new Date().toISOString() })
    .catch(() => {})

  return NextResponse.json({ received: true })
}
