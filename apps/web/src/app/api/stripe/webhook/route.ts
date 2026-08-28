import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { payoutSplit, getPayoutSettings, clawbackCommission } from '@/lib/payouts'
import { notify, NOTIFY_WORKFLOWS } from '@/lib/notify'
import { getPlatformSettings } from '@/lib/platform-settings'
import { reportFailure, reportSuccess } from '@/lib/alerts'
import { sendEmail } from '@/lib/email'
import {
  consumeReferralRewardForInvoice,
  disqualifyPendingReferralForListing,
  ensureReferralProgram,
  linkDirectorySubscription,
  recordReferralAttribution,
} from '@/lib/referrals-server'
import {
  referralCouponFromInvoice,
  referralDiscountAmount,
} from '@/lib/referrals'
import { directoryOrderPaymentPatch, salesDirectoryClaimStatus } from '@/lib/sales-directory'
import { isOriginatingRefund, refundListingPatch } from '@/lib/refund-decision'
import { getSalesProduct } from '@/lib/sales-products'
import { purchaseConfirmationEmail } from '@/lib/buyer-emails'
import { notifyUser } from '@/lib/user-notifications'

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

function stripeObjectId(value: any): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id || null
}

// Resolve the charge id behind a completed checkout session so commission
// transfers can draw from that specific charge (source_transaction) even while
// its funds are still `pending` — which is what stops the "insufficient funds"
// payout failure on fresh sales. Best-effort: returns null on any lookup failure,
// in which case payouts fall back to requiring available balance.
async function resolveSessionChargeId(session: any): Promise<string | null> {
  try {
    const piId = stripeObjectId(session.payment_intent)
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId)
      const charge = stripeObjectId((pi as any).latest_charge)
      if (charge) return charge
    }
    const invoiceId = stripeObjectId(session.invoice)
    if (invoiceId) {
      const inv = await stripe.invoices.retrieve(invoiceId)
      const charge = stripeObjectId((inv as any).charge)
      if (charge) return charge
    }
    const subId = stripeObjectId(session.subscription)
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] })
      const inv: any = (sub as any).latest_invoice
      const charge = inv && typeof inv === 'object' ? stripeObjectId(inv.charge) : null
      if (charge) return charge
    }
  } catch {
    /* fall back to balance-based transfer */
  }
  return null
}

async function setPaymentStatusByField(field: string, value: string, status: string) {
  if (!value) return
  const now = new Date().toISOString()
  const snap = await adminDb.collection('ad_purchases').where(field, '==', value).get()
  await Promise.all(snap.docs.map((d) => d.ref.set({ payment_status: status, updated_at: now }, { merge: true })))
}

async function setSalesOrderBillingStatus(
  subscriptionId: string,
  billingStatus: string,
  extra: Record<string, unknown> = {}
) {
  if (!subscriptionId) return
  const snap = await adminDb.collection('sales_orders').where('stripe_subscription_id', '==', subscriptionId).get()
  const now = new Date().toISOString()
  await Promise.all(
    snap.docs.map((document) =>
      document.ref.set({ billing_status: billingStatus, ...extra, updated_at: now }, { merge: true })
    )
  )
}

// ---- event handlers (all write Firestore) -----------------------------------

async function syncSalesOrderFromCheckout(session: any, metadata: Record<string, any>) {
  if (!metadata.sales_order_id) return null
  const orderRef = adminDb.collection('sales_orders').doc(metadata.sales_order_id)
  const orderSnapshot = await orderRef.get()
  if (!orderSnapshot.exists) throw new Error('Stripe Session references a missing sales order.')
  const order = orderSnapshot.data() as Record<string, any>
  if (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id) {
    throw new Error('Stripe Session does not match the recorded sales order checkout.')
  }
  if (metadata.product_id !== order.product_id || metadata.sold_by !== order.sold_by) {
    throw new Error('Stripe Session metadata does not match the recorded sales order.')
  }
  if (session.currency !== (order.currency || 'usd')) {
    throw new Error('Stripe Session currency does not match the recorded sales order.')
  }
  if (session.amount_subtotal != null && Number(session.amount_subtotal) !== Number(order.amount)) {
    throw new Error('Stripe Session subtotal does not match the server-priced sales order.')
  }
  const paymentStatus =
    session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
      ? 'paid'
      : 'pending'
  await orderRef.set(
    {
      checkout_status: 'completed',
      payment_status: paymentStatus,
      billing_status: session.subscription ? 'active' : 'completed',
      fulfillment_status: paymentStatus === 'paid' ? 'awaiting_intake' : 'awaiting_payment',
      stripe_checkout_session_id: session.id,
      stripe_customer_id: stripeObjectId(session.customer),
      stripe_subscription_id: stripeObjectId(session.subscription),
      stripe_payment_intent_id: stripeObjectId(session.payment_intent),
      amount_paid: session.amount_total || 0,
      discount_amount: Math.max(0, (session.amount_subtotal || 0) - (session.amount_total || 0)),
      customer_email: session.customer_details?.email || session.customer_email || metadata.contact_email || null,
      paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
  return { paymentStatus, order }
}

async function handleCheckoutCompleted(session: any) {
  const metadata = session.metadata || {}

  // The canonical order is updated before any product-specific legacy branch
  // returns, so jobs, events, directory listings, and ads share one lifecycle.
  const salesOrderSync = await syncSalesOrderFromCheckout(session, metadata)
  if (salesOrderSync && salesOrderSync.paymentStatus !== 'paid') return

  // Operator "cha-ching" alert on every completed payment (Novu — dormant until
  // NOVU_SECRET_KEY + a "new-sale" workflow exist). Best-effort; never blocks
  // fulfillment.
  await notify({
    workflowId: NOTIFY_WORKFLOWS.newSale,
    to: { subscriberId: 'operator', email: process.env.ALERT_EMAIL },
    payload: {
      amount: ((session.amount_total || 0) / 100).toFixed(2),
      currency: (session.currency || 'usd').toUpperCase(),
      product: metadata.product_id || metadata.plan || metadata.adType || metadata.type || 'sale',
      business: metadata.companyName || metadata.contact_email || '',
    },
  })

  // Tell the BUYER their money arrived — for every product. This webhook is
  // the only guaranteed post-payment code path, and until now it sent the
  // customer nothing; Stripe's own emails cover subscription invoices only,
  // so one-time buyers (jobs, events, stories, custom) paid into silence.
  // Best-effort: a mail failure must never block fulfillment.
  try {
    const buyerEmail =
      session.customer_details?.email || session.customer_email || metadata.contact_email || null
    if (buyerEmail) {
      const orderRecord = salesOrderSync?.order as Record<string, any> | undefined
      const productName =
        orderRecord?.product_name ||
        getSalesProduct(metadata.product_id)?.name ||
        metadata.plan ||
        metadata.adType ||
        (metadata.type === 'event_feature' ? 'Featured Event' : metadata.type) ||
        'CityBeat order'
      const statusUrl = metadata.sales_order_id
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'}/${orderRecord?.locale === 'es' ? 'es' : 'en'}/order/${metadata.sales_order_id}?session_id=${session.id}`
        : undefined
      const { subject, html } = purchaseConfirmationEmail({
        productName,
        businessName: orderRecord?.business_name || metadata.companyName || null,
        amountTotal: session.amount_total,
        currency: session.currency || 'usd',
        locale: orderRecord?.locale,
        statusUrl,
      })
      await sendEmail(String(buyerEmail), subject, html)
    }
  } catch {
    /* never block fulfillment on a courtesy email */
  }

  // Founders offer: the FIRST invoice was just paid at full price; now attach
  // the 100%-off repeating(3) coupon so months 2-4 are free and Stripe resumes
  // normal billing from month 5 on its own. Applied here — after payment —
  // precisely so the first charge can never be discounted. Best-effort: a
  // coupon failure must not block fulfillment (ops is alerted instead).
  if (metadata.promo === 'founders_3mo_free' && session.subscription) {
    try {
      const subscriptionId = String(stripeObjectId(session.subscription))
      const COUPON_ID = 'founders-3mo-free-100'
      let coupon: Stripe.Coupon | null = null
      try {
        coupon = await stripe.coupons.retrieve(COUPON_ID)
      } catch (error: any) {
        if (error?.code !== 'resource_missing' && error?.statusCode !== 404) throw error
      }
      if (!coupon) {
        try {
          coupon = await stripe.coupons.create({
            id: COUPON_ID,
            percent_off: 100,
            duration: 'repeating',
            duration_in_months: 3,
            name: 'CityBeat Founders offer — 3 months free',
            metadata: { citybeat_promo: 'founders_3mo_free' },
          })
        } catch (error: any) {
          // A concurrent webhook may have created it first.
          if (error?.code === 'resource_already_exists' || error?.statusCode === 409) {
            coupon = await stripe.coupons.retrieve(COUPON_ID)
          } else throw error
        }
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (!(subscription as any).discount) {
        await stripe.subscriptions.update(subscriptionId, { coupon: COUPON_ID, proration_behavior: 'none' })
      }
    } catch (error) {
      await reportFailure('founders-promo-coupon', error, {
        session_id: session.id,
        note: 'First month charged; the 3-free-months coupon did NOT attach — apply founders-3mo-free-100 to the subscription by hand.',
      }).catch(() => {})
    }
  }

  // Notify the selling REP that their sale was paid (rep learned this by
  // polling before). Best-effort; the rep is metadata.payout_user_id/sold_by.
  try {
    const repId = metadata.payout_user_id || metadata.sold_by || (salesOrderSync?.order as any)?.sold_by
    if (repId) {
      const biz = (salesOrderSync?.order as any)?.business_name || metadata.companyName || 'a customer'
      await notifyUser({
        userId: String(repId),
        notificationId: `sale_paid:${session.id}`,
        type: 'sale_paid',
        title: `Payment received: ${biz}`,
        title_es: `Pago recibido: ${biz}`,
        body: `Your sale to ${biz} was paid. Commission accrues and pays on the next cycle.`,
        body_es: `Tu venta a ${biz} fue pagada. La comision se acumula y se paga en el proximo ciclo.`,
        link: '/admin/sales/me',
        emailChannel: false,
      })
    }
  } catch {
    /* never block fulfillment on a rep notification */
  }

  // The charge behind this sale, resolved once and passed to every payout below so
  // transfers succeed against still-pending funds (see resolveSessionChargeId).
  const sourceTransaction = await resolveSessionChargeId(session)

  // Canonical Sales Desk orders earn commission after confirmed payment, but
  // operational records are deferred until the paid product brief is complete.
  if (salesOrderSync) {
    const order = salesOrderSync.order
    const isDirectory = metadata.product_family === 'directory'
    if (!isDirectory) {
      const advertiserEmail = session.customer_email || session.customer_details?.email || order.contact_email || null
      await adminDb.collection('ad_purchases').doc(session.id).set(
        {
          session_id: session.id,
          sales_order_id: metadata.sales_order_id,
          advertiser_email: advertiserEmail,
          company_name: order.business_name || metadata.companyName || null,
          ad_type: metadata.intake_kind || order.intake_kind || 'advertisement',
          billing_cycle: order.billing_interval || null,
          amount_total: session.amount_total || 0,
          currency: session.currency || 'usd',
          payment_status: 'completed',
          stripe_customer_id: stripeObjectId(session.customer),
          stripe_subscription_id: stripeObjectId(session.subscription),
          stripe_payment_intent_id: stripeObjectId(session.payment_intent),
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    const payoutService = isDirectory
      ? 'directory'
      : metadata.intake_kind === 'sponsored_story'
        ? 'sponsored_post'
        : 'ad_campaign'
    await payoutSplit({
      stripe,
      sellerUserId: metadata.payout_user_id || null,
      service: payoutService,
      amountTotal: session.amount_total,
      currency: session.currency || 'usd',
      sourcePaymentId: session.id,
      sourceTransaction,
      // Hold the commission from the moment the customer actually paid, not from
      // whenever this webhook happened to be processed (a redelivery can land days later).
      saleAt: session.created ? new Date(session.created * 1000) : null,
    })
    await recordSubscriptionAttribution(session.subscription, metadata.payout_user_id, payoutService)
    if (isDirectory && order.listing_preexisting && metadata.listing_id) {
      await markOutreachConverted(metadata.listing_id)
    }

    // Tier/claim-status/Stripe linkage for a Sales Desk directory order. This
    // used to be entirely skipped for canonical (sales_order_id) checkouts —
    // only the content brief (name/address/photos) gets written later, when
    // the customer finishes /fulfill/{orderId}; nothing ever ran the same
    // premium-claim logic self-serve/legacy checkouts get above. Run it at
    // payment time, independent of intake completion — see
    // directoryOrderPaymentPatch for why.
    if (isDirectory && metadata.listing_id) {
      const directorySubscriptionId = stripeObjectId(session.subscription)
      const directoryCustomerId = stripeObjectId(session.customer)
      const currentListingDoc = await adminDb.collection('directory_listings').doc(metadata.listing_id).get()
      const currentListing = currentListingDoc.exists ? (currentListingDoc.data() as Record<string, any>) : {}
      const listingPatch = directoryOrderPaymentPatch({
        metadata,
        order,
        currentListing,
        subscriptionId: directorySubscriptionId,
        customerId: directoryCustomerId,
      })
      await adminDb.collection('directory_listings').doc(metadata.listing_id).set(listingPatch, { merge: true })
      await linkDirectorySubscription({
        subscriptionId: directorySubscriptionId,
        customerId: directoryCustomerId,
        listingId: metadata.listing_id,
        ownerId: currentListing.owner_id || null,
        plan: metadata.plan || null,
        billingCycle: metadata.billing_cycle || order.billing_interval || null,
      })

      // Referral capture for a Sales Desk order. A rep-run checkout has no
      // signed-in customer session, so there's no browser cookie to read the
      // way self-serve checkout does — a rep instead types in the code the
      // client mentions (see the "Referral code" field on /admin/sales/me,
      // metadata.referral_code). Attribution only makes sense when the listing
      // already had an owner BEFORE this order (an existing self-serve
      // customer a rep is now upselling/upgrading) — a brand-new rep-sold
      // listing has no owner yet to credit until an admin attaches one later,
      // so there is nothing to attribute at payment time.
      if (currentListing.owner_id && directorySubscriptionId) {
        await ensureReferralProgram({
          listingId: metadata.listing_id,
          ownerId: currentListing.owner_id,
          subscriptionId: directorySubscriptionId,
        })
        if (metadata.referral_code) {
          await recordReferralAttribution({
            code: metadata.referral_code,
            referredListingId: metadata.listing_id,
            referredOwnerId: currentListing.owner_id,
            referredSubscriptionId: directorySubscriptionId,
            referredCustomerId: directoryCustomerId,
            referredEmail: session.customer_details?.email || session.customer_email || null,
            referredPlan: metadata.plan || null,
            checkoutCreated: session.created || null,
          })
        }
      }
    }
    return
  }

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
    const directorySubscriptionId = stripeObjectId(session.subscription)
    const directoryCustomerId = stripeObjectId(session.customer)
    // Tier the admin will grant on approval (premium/featured). Founding members
    // get Premium at the locked launch price and are flagged for the 100 cap.
    const pendingTier = metadata.tier === 'featured' ? 'featured' : 'premium'
    const currentListingDoc = await adminDb
      .collection('directory_listings')
      .doc(metadata.listing_id)
      .get()
    const currentListing = currentListingDoc.exists
      ? (currentListingDoc.data() as Record<string, any>)
      : {}
    const effectiveOwnerId = metadata.owner_id || currentListing.owner_id || null
    const claimStatus = salesDirectoryClaimStatus({
      ownerId: effectiveOwnerId,
      soldBy: metadata.sold_by,
      listingPreexisting: metadata.listing_preexisting,
    })
    const listingPatch: Record<string, any> = {
      claim_status: claimStatus,
      pending_tier: pendingTier,
      // Same fraud gate as tier: a pending (unverified/rep) claim must not
      // light up the directory homepage before an admin confirms it.
      pending_sponsored: metadata.sponsored === 'true',
      plan: metadata.plan || 'premium_monthly',
      founding_member: metadata.founding === 'true',
      stripe_subscription_id: directorySubscriptionId,
      stripe_customer_id: directoryCustomerId,
      updated_at: new Date().toISOString(),
    }
    if (claimStatus === 'pending_approval') listingPatch.claimed_at = new Date().toISOString()
    if (effectiveOwnerId) listingPatch.owner_id = effectiveOwnerId
    if (metadata.sold_by) listingPatch.sold_by_rep = metadata.sold_by
    if (metadata.contact_email) listingPatch.contact_email = metadata.contact_email

    // Ownership check: did this payer pass the email-code claim verification for
    // THIS listing? Payment alone must never prove ownership — otherwise anyone
    // could pay $19 to take over a real business's listing. The flag is stamped on
    // the listing so the admin queue can show verified vs unverified claims.
    let ownershipVerified = false
    if (effectiveOwnerId) {
      const vSnap = await adminDb
        .collection('directory_claims')
        .where('listing_id', '==', metadata.listing_id)
        .where('user_id', '==', effectiveOwnerId)
        .where('status', '==', 'verified')
        .limit(1)
        .get()
        .catch(() => ({ empty: true }) as any)
      ownershipVerified = !vSnap.empty
    }
    listingPatch.ownership_verified = ownershipVerified

    // Instant approval (godmode opt-in): a self-serve owner who paid gets approved
    // immediately, skipping manual review — but ONLY if they also verified
    // ownership. Unverified paid claims always stay pending for admin review.
    // Rep field sales (sold_by, no account) always stay pending so an admin can
    // attach the real owner.
    const settings = await getPlatformSettings()
    if (settings.auto_approve_claims && metadata.owner_id && !metadata.sold_by && ownershipVerified) {
      listingPatch.claim_status = 'approved'
      listingPatch.tier = pendingTier
      listingPatch.pending_tier = null
      listingPatch.is_advertiser = true
      if (metadata.sponsored === 'true') {
        listingPatch.is_sponsored = true
        listingPatch.sponsored_since = new Date().toISOString()
      }
      listingPatch.pending_sponsored = null
    }

    await adminDb.collection('directory_listings').doc(metadata.listing_id).set(listingPatch, { merge: true })

    await linkDirectorySubscription({
      subscriptionId: directorySubscriptionId,
      customerId: directoryCustomerId,
      listingId: metadata.listing_id,
      ownerId: effectiveOwnerId,
      plan: metadata.plan || null,
      billingCycle: metadata.billing_cycle || null,
    })

    // Every self-serve paying owner gets a stable personalized link immediately.
    // If this checkout came through another valid link, create the pending
    // three-month attribution exactly once (the referred listing is the doc id).
    if (metadata.owner_id && directorySubscriptionId) {
      await ensureReferralProgram({
        listingId: metadata.listing_id,
        ownerId: metadata.owner_id,
        subscriptionId: directorySubscriptionId,
      })
      if (metadata.referral_code) {
        await recordReferralAttribution({
          code: metadata.referral_code,
          referredListingId: metadata.listing_id,
          referredOwnerId: metadata.owner_id,
          referredSubscriptionId: directorySubscriptionId,
          referredCustomerId: directoryCustomerId,
          referredEmail: session.customer_details?.email || session.customer_email || null,
          referredPlan: metadata.plan || null,
          checkoutCreated: session.created || null,
        })
      }
    }

    // Funnel close: mark any outreach for this listing as converted.
    await markOutreachConverted(metadata.listing_id)
    // Multi-party split: Editor + Sales rep get transfers per the split table; the
    // platform (App + Developer) keeps the remainder. The seller is the attributed
    // rep, or none (autonomous/organic self-serve → Editor's autonomous share).
    await payoutSplit({
      stripe,
      sellerUserId: metadata.payout_user_id || null,
      service: 'directory',
      amountTotal: session.amount_total,
      currency: session.currency || 'usd',
      sourcePaymentId: session.id,
      sourceTransaction,
      // Hold the commission from the moment the customer actually paid, not from
      // whenever this webhook happened to be processed (a redelivery can land days later).
      saleAt: session.created ? new Date(session.created * 1000) : null,
    })
    // Remember the seller + service so renewals re-apply the split (residual mode).
    await recordSubscriptionAttribution(directorySubscriptionId, metadata.payout_user_id, 'directory')
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

    // This branch returns early, so it must record revenue and commission
    // ITSELF — otherwise the sale never reaches the ledger below. Until the
    // metadata routing was fixed, this branch could never fire and these
    // purchases fell through to the generic handler, which did record them; so
    // making provisioning work would otherwise have silently traded a
    // never-published product for unrecorded revenue and unpaid commission.
    const provisionService = provisionMeta.type === 'job' ? 'job' : 'ad_campaign'
    await adminDb.collection('ad_purchases').doc(session.id).set(
      {
        session_id: session.id,
        product_id: provisionMeta.productId,
        advertiser_email: session.customer_email || session.customer_details?.email || null,
        ad_type: provisionMeta.type,
        amount_total: session.amount_total || 0,
        currency: session.currency || 'usd',
        payment_status: 'completed',
        stripe_customer_id: stripeObjectId(session.customer),
        stripe_payment_intent_id: stripeObjectId(session.payment_intent),
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    await payoutSplit({
      stripe,
      sellerUserId: metadata.payout_user_id || null,
      service: provisionService,
      amountTotal: session.amount_total,
      currency: session.currency || 'usd',
      sourcePaymentId: session.id,
      sourceTransaction,
      saleAt: session.created ? new Date(session.created * 1000) : null,
    })
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

  // Multi-party split for ad/sponsored (and any non-directory) sale: Editor + rep
  // get transfers per the ads split; platform keeps the rest. Seller = attributed
  // rep, or none (organic buyer → Editor's autonomous share, which is 0 for ads).
  await payoutSplit({
    stripe,
    sellerUserId: metadata.payout_user_id || null,
    service: metadata.adType === 'sponsored_post' ? 'sponsored_post' : 'ad_campaign',
    amountTotal: session.amount_total,
    currency: session.currency || 'usd',
    sourcePaymentId: session.id,
    sourceTransaction,
    saleAt: session.created ? new Date(session.created * 1000) : null,
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

// Persist the seller + service on a subscription so renewals can re-apply the
// split. Recorded even with NO seller (autonomous/organic) so the Editor still
// earns their residual share on those renewals.
async function recordSubscriptionAttribution(subscriptionId: any, payeeUserId: any, service: string) {
  if (!subscriptionId) return
  await adminDb.collection('subscriptions').doc(String(subscriptionId)).set(
    { payout_user_id: payeeUserId || null, payout_service: service, updated_at: new Date().toISOString() },
    { merge: true }
  )
}

// Residual commission: on a subscription RENEWAL (not the first invoice, which
// checkout.session.completed already paid), pay the attributed rep again — but
// only when godmode has commission_mode = 'residual'. Dedup is PER-SHARE inside
// payoutSplit (the ledger `paid` check + stable idempotency key), so re-running on
// a webhook retry never double-pays AND always completes any share a prior attempt
// left unpaid — unlike a coarse per-invoice guard, which would skip an unpaid
// share once any other share for the invoice had a row.
async function payResidualCommissionIfDue(invoice: any) {
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (invoice.billing_reason !== 'subscription_cycle' || !subscriptionId) return

  const settings = await getPayoutSettings()
  if (settings.commission_mode !== 'residual') return

  const subDoc = await adminDb.collection('subscriptions').doc(subscriptionId).get()
  const sub = subDoc.exists ? (subDoc.data() as any) : null
  if (!sub?.payout_service) return

  await payoutSplit({
    stripe,
    sellerUserId: sub.payout_user_id || null,
    service: sub.payout_service,
    amountTotal: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: invoice.currency || 'usd',
    sourcePaymentId: invoice.id,
    sourceTransaction: stripeObjectId(invoice.charge),
    saleAt: invoice.created ? new Date(invoice.created * 1000) : null,
  })
}

async function handleChargeRefunded(charge: any) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : ''
  const fullyRefunded = Boolean(charge.refunded) || Number(charge.amount_refunded || 0) >= Number(charge.amount || 0)
  const doc = (await findOne('ad_purchases', 'stripe_payment_intent_id', pi)) || (await findOne('ad_purchases', 'session_id', charge.id))
  if (doc) {
    await doc.ref.set(
      { payment_status: fullyRefunded ? 'refunded' : 'partially_refunded', updated_at: new Date().toISOString() },
      { merge: true }
    )
  }
  let orders: FirebaseFirestore.QueryDocumentSnapshot[] = []
  // Whether the refunded charge is the one that ORIGINATED these orders, rather
  // than a later renewal that merely shares their subscription. Commission is
  // accrued per payment (the first sale keys on the checkout session, renewals
  // on the invoice), so clawing back by the order's session id is only correct
  // for the originating charge — otherwise refunding a single renewal month
  // reverses the whole original sale's commission.
  let matchedByPaymentIntent = false
  let invoiceBillingReason: string | null = null
  if (pi) {
    const snapshot = await adminDb.collection('sales_orders').where('stripe_payment_intent_id', '==', pi).get()
    orders = snapshot.docs
    matchedByPaymentIntent = orders.length > 0
  }
  if (!orders.length && charge.invoice) {
    const invoice = await stripe.invoices.retrieve(stripeObjectId(charge.invoice) || String(charge.invoice))
    invoiceBillingReason = (invoice as any).billing_reason || null
    const subscriptionId = stripeObjectId((invoice as any).subscription)
    if (subscriptionId) {
      const snapshot = await adminDb
        .collection('sales_orders')
        .where('stripe_subscription_id', '==', subscriptionId)
        .get()
      orders = snapshot.docs
    }
  }
  // Pure, unit-tested decision (lib/refund-decision.ts) — the exact rule that
  // stops a renewal refund from downgrading a still-billing listing.
  const isOriginatingCharge = isOriginatingRefund({ matchedByPaymentIntent, invoiceBillingReason })

  const now = new Date().toISOString()

  // Un-book the invoice ledger. `payments` rows are keyed by invoice id and
  // the finance dashboard counts status 'paid' forever — so a refund used to
  // leave collected-revenue overstated permanently. Partial refunds keep the
  // row but record amount_refunded, which finance subtracts (collectedCents).
  const refundedInvoiceId = stripeObjectId(charge.invoice)
  if (refundedInvoiceId) {
    await adminDb.collection('payments').doc(refundedInvoiceId).set(
      fullyRefunded
        ? { status: 'refunded', refunded_at: now, amount_refunded: Number(charge.amount_refunded || 0) }
        : { amount_refunded: Number(charge.amount_refunded || 0), updated_at: now },
      { merge: true }
    ).catch(() => {})
  }

  for (const orderDocument of orders) {
    const order = orderDocument.data() as Record<string, any>
    await orderDocument.ref.set(
      {
        payment_status: fullyRefunded ? 'refunded' : order.payment_status || 'paid',
        billing_status: fullyRefunded ? 'refunded' : order.billing_status,
        fulfillment_status: 'needs_attention',
        refund_status: fullyRefunded ? 'full' : 'partial',
        refund_amount: Number(charge.amount_refunded || 0),
        refunded_at: now,
        updated_at: now,
      },
      { merge: true }
    )
    const purchases = await adminDb
      .collection('ad_purchases')
      .where('sales_order_id', '==', orderDocument.id)
      .get()
    await Promise.all(
      purchases.docs.map((purchase) =>
        purchase.ref.set(
          { payment_status: fullyRefunded ? 'refunded' : 'partially_refunded', updated_at: now },
          { merge: true }
        )
      )
    )

    const target = order.fulfillment_target
    if (target?.collection && target?.id) {
      await adminDb.collection(String(target.collection)).doc(String(target.id)).set(
        {
          payment_status: fullyRefunded ? 'refunded' : 'partially_refunded',
          fulfillment_status: 'needs_attention',
          ...(target.collection === 'directory_listings'
            // Downgrade ONLY when the refunded charge is the originating sale.
            // A goodwill refund of a single renewal must not strip the tier of a
            // customer whose subscription is still live and still billing them:
            // that left them paying full price for a Basic listing forever, with
            // nothing to restore it — not the next successful payment, not even
            // re-approving the claim. The isOriginatingCharge guard already
            // existed for the commission clawback below; it was simply never
            // applied to the downgrade.
            // Clearing the PENDING grants matters too: admin approval reads
            // pending_tier/pending_sponsored and grants them with no check that
            // the subscription still exists, so leaving them set after a real
            // refund handed the paid tier and the Sponsored slot to someone who
            // had already been given their money back.
            ? refundListingPatch({ fullyRefunded, isOriginatingCharge })
            : {
                status: 'needs_attention',
                is_active: false,
                // Jobs: the public board filters ONLY on is_paid + expires_at,
                // so deactivating is not a takedown — expire it too.
                ...(target.collection === 'jobs' ? { expires_at: now } : {}),
              }),
          updated_at: now,
        },
        { merge: true }
      )
      if (fullyRefunded && target.collection === 'directory_listings') {
        await disqualifyPendingReferralForListing(String(target.id), 'refunded')
      }
      // A newsletter sponsorship is fulfilled into ad_campaigns, but the weekly
      // digest renders the MIRROR at ad_banners/campaign:<id> (see
      // /api/admin/campaigns). Patching only the fulfillment target would leave
      // a refunded or disputed sponsor mailing to every subscriber every Friday.
      if (fullyRefunded && target.collection === 'ad_campaigns') {
        await adminDb
          .collection('ad_banners')
          .doc(`campaign:${target.id}`)
          .set({ is_active: false, updated_at: now }, { merge: true })
          .catch(() => {})
      }
    }
  }

  // Legacy directory purchases predate sales_orders and are matched by customer.
  if (fullyRefunded && isOriginatingCharge && !orders.length && charge.customer) {
    const listing = await findOne('directory_listings', 'stripe_customer_id', charge.customer)
    if (listing) {
      await listing.ref.set(
        {
          tier: 'basic',
          pending_tier: null,
          pending_sponsored: null,
          is_sponsored: false,
          payment_status: 'refunded',
          updated_at: now,
        },
        { merge: true }
      )
      await disqualifyPendingReferralForListing(listing.id, 'refunded')
    }
  }

  // Reverse the rep/editor commission for this sale. Inside the 7-day hold the
  // share is still `held`, so this costs nothing — nothing was ever sent. If a
  // payout cycle already paid it, it becomes a recorded debt and ops is alerted
  // (clawbackCommission). Commission is keyed by the ORIGINATING payment id
  // (the checkout session), which is what payoutSplit stored as source_payment —
  // recover it from the matched sales orders, since a charge/invoice id will not
  // match. Best-effort: a clawback failure must never wedge the refund handler.
  // A PARTIAL refund reversed nothing at all: the whole clawback lived inside
  // `if (fullyRefunded)`. With split rates reaching 65-70% on rep-sold deals,
  // refunding much more than a third of a sale made that transaction
  // net-negative for the platform, silently. Proportional reduction of held
  // shares is the proper fix; until then, make sure a human is told rather than
  // letting it pass unnoticed.
  if (!fullyRefunded && Number(charge.amount_refunded || 0) > 0) {
    await reportFailure(
      'commission-partial-refund',
      new Error(
        `Partial refund of $${(Number(charge.amount_refunded || 0) / 100).toFixed(2)} on a $${(Number(charge.amount || 0) / 100).toFixed(2)} charge — commission was NOT reduced and may now exceed the net revenue. Adjust the ledger manually.`
      ),
      { charge_id: charge.id, amount_refunded: charge.amount_refunded, amount: charge.amount }
    ).catch(() => {})
  }

  if (fullyRefunded) {
    // The charge id is stored on EVERY accrued share as source_transaction, so
    // this reverses exactly the payment that was refunded — including for
    // self-serve sales, which have no sales_orders row at all.
    await clawbackCommission({ sourceTransaction: charge.id, reason: 'refund' }).catch(() => {})

    // The session-id pass is a fallback for shares whose source_transaction
    // could not be resolved at accrual time (resolveSessionChargeId can return
    // null). It is only valid for the ORIGINATING charge: a renewal refund
    // reaching this with the original order's session id would reverse the
    // whole first sale's commission for one refunded month.
    if (isOriginatingCharge) {
      const sessionIds = new Set<string>()
      for (const orderDocument of orders) {
        const order = orderDocument.data() as Record<string, any>
        if (order.stripe_checkout_session_id) sessionIds.add(String(order.stripe_checkout_session_id))
      }
      for (const sourcePaymentId of sessionIds) {
        await clawbackCommission({ sourcePaymentId, reason: 'refund' }).catch(() => {})
      }
    }
  }
}

// A chargeback (charge.dispute.created) is the customer contesting the charge
// directly with their bank — a stronger signal than a refund and one Stripe
// freezes funds against immediately. Refunds already trigger the downgrade
// path below (tier reset, sponsorship pulled, pending referral disqualified,
// ad campaign/banner paused); a dispute deserves the identical protection and
// previously got none at all, leaving a disputed listing/campaign fully live
// indefinitely while the dispute was contested. Restoring service if the
// dispute is later won is intentionally NOT automated here — that is an
// admin judgment call (see the ops alert below), not a safe webhook action.
async function handleChargeDisputeCreated(dispute: any) {
  const chargeId = stripeObjectId(dispute.charge)
  if (!chargeId) return
  let charge: any
  try {
    charge = await stripe.charges.retrieve(chargeId)
  } catch {
    return
  }
  await handleChargeRefunded({ ...charge, refunded: true, amount_refunded: charge.amount })
  // handleChargeRefunded already reversed the commission, but label it as the
  // dispute it actually was so the ledger reads truthfully.
  await clawbackCommission({ sourceTransaction: chargeId, reason: 'dispute' }).catch(() => {})
  await reportFailure(
    'stripe-webhook-dispute',
    new Error(`Chargeback opened (${dispute.reason || 'unknown reason'}) — listing/campaign downgraded, respond to the dispute in Stripe`),
    { dispute_id: dispute.id, charge_id: chargeId, amount: dispute.amount, reason: dispute.reason }
  )
}

async function recordPayment(invoice: any) {
  const subscriptionId = stripeObjectId(invoice.subscription)
  const subscriptionDoc = subscriptionId
    ? await adminDb.collection('subscriptions').doc(subscriptionId).get()
    : null
  const subscription = subscriptionDoc?.exists ? (subscriptionDoc.data() as any) : null
  const metadata = invoice.subscription_details?.metadata || {}
  const discountAmount = referralDiscountAmount(invoice)
  const referralCoupon = referralCouponFromInvoice(invoice)
  const amountPaid = invoice.amount_paid ?? invoice.amount_due ?? 0

  await adminDb.collection('payments').doc(invoice.id).set(
    {
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer || null,
      stripe_subscription_id: subscriptionId,
      advertiser_id: metadata.owner_id || subscription?.advertiser_id || subscription?.owner_id || null,
      listing_id: metadata.listing_id || subscription?.listing_id || null,
      plan: metadata.plan || subscription?.plan_id || null,
      billing_cycle: metadata.billing_cycle || subscription?.billing_cycle || null,
      advertiser_email: invoice.customer_email || null,
      gross_amount: invoice.subtotal ?? amountPaid + discountAmount,
      discount_amount: discountAmount,
      discount_source: referralCoupon ? 'referral' : discountAmount > 0 ? 'stripe' : null,
      discount_coupon_id: referralCoupon?.id || null,
      amount: amountPaid,
      currency: invoice.currency || 'usd',
      status: invoice.status || 'paid',
      invoice_pdf: invoice.invoice_pdf || null,
      created_at: new Date(((invoice.created || Date.now() / 1000) as number) * 1000).toISOString(),
    },
    { merge: true }
  )
}

// Re-enable only the placements a failed payment paused — never anything an
// admin rejected or a reversal switched off. Covers both collections, since a
// newsletter sponsorship lives in ad_campaigns and its rendered mirror in
// ad_banners.
async function reactivatePastDuePlacements(subscriptionId: string) {
  if (!subscriptionId) return
  const now = new Date().toISOString()
  const [campaigns, banners] = await Promise.all([
    adminDb.collection('ad_campaigns').where('stripe_subscription_id', '==', subscriptionId).get(),
    adminDb.collection('ad_banners').where('stripe_subscription_id', '==', subscriptionId).get(),
  ])
  await Promise.all(
    [...campaigns.docs, ...banners.docs]
      .filter((d) => (d.data() as any)?.status === 'past_due')
      .map((d) =>
        d.ref.set({ status: 'running', is_active: true, reactivated_at: now, updated_at: now }, { merge: true })
      )
  )
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  await recordPayment({ ...invoice, status: 'paid' })
  await setPaymentStatusByField('stripe_customer_id', invoice.customer || '', 'completed')
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (subscriptionId) {
    await setSalesOrderBillingStatus(subscriptionId, 'active', {
      last_invoice_id: invoice.id,
      last_invoice_amount: invoice.amount_paid ?? invoice.amount_due ?? 0,
      last_invoice_discount: referralDiscountAmount(invoice),
      last_invoice_paid_at: new Date().toISOString(),
    })
    await adminDb.collection('subscriptions').doc(subscriptionId).set(
      { status: 'active', stripe_customer_id: invoice.customer || null, updated_at: new Date().toISOString() }, { merge: true }
    )

    // A declined card pauses the advertiser's placement
    // (setAdCampaignsBySubscription in handleInvoicePaymentFailed) and the
    // dunning email promises it resumes on payment — but nothing ever turned it
    // back on. The advertiser paid $25-$50/month for an ad that never appeared
    // again, and the sales order showed the deal as healthy. Routine card expiry
    // triggers this, so every advertiser eventually hits it.
    //
    // Only revive rows the FAILURE paused (status 'past_due'). Anything an admin
    // rejected, or a refund/cancellation killed, must stay off.
    await reactivatePastDuePlacements(subscriptionId)
  }
  // Pay the rep their residual share on renewals, if godmode enabled it.
  await payResidualCommissionIfDue(invoice)
  // Consume the exact referral months encoded on the invoice coupon. The usage
  // document is keyed by invoice id, so Stripe retries cannot double-decrement.
  await consumeReferralRewardForInvoice(stripe, invoice)
}

// Dunning: a failed renewal silently churns unless the customer hears about it.
// One email per invoice (dedup in `dunning_emails`), pointing at Stripe's hosted
// invoice page where they can pay / update the card without logging in anywhere.
async function sendDunningEmail(invoice: any) {
  const to = invoice.customer_email
  const url = invoice.hosted_invoice_url
  if (!to || !url || !invoice.id) return
  const ref = adminDb.collection('dunning_emails').doc(String(invoice.id))
  const seen = await ref.get().catch(() => null)
  if (seen?.exists) return

  const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2)
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>Your CityBeat payment of <strong>$${amount}</strong> didn't go through — usually an expired or declined card.</p>
  <p>Your listing benefits pause until the payment succeeds. It takes a minute to fix:</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Pay invoice / update card</a></p>
  <p style="color:#666;font-size:13px">¿Prefieres español? Tu pago de $${amount} no se procesó — usa el botón de arriba para actualizar tu tarjeta.</p>
  <p style="font-size:11px;color:#999">Sent via citybeatmag.co · Stripe retries automatically for a few days.</p></div>`

  const result = await sendEmail(to, `Action needed: your CityBeat payment of $${amount} failed`, html).catch(() => ({ sent: false }))
  await ref.set({
    invoice_id: invoice.id,
    customer_email: to,
    amount_due: invoice.amount_due ?? 0,
    sent: Boolean((result as any).sent),
    created_at: new Date().toISOString(),
  }).catch(() => {})
}

async function handleInvoicePaymentFailed(invoice: any) {
  await recordPayment({ ...invoice, status: 'payment_failed' })
  await setPaymentStatusByField('stripe_customer_id', invoice.customer || '', 'past_due')
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (subscriptionId) {
    await setSalesOrderBillingStatus(subscriptionId, 'past_due', {
      last_failed_invoice_id: invoice.id,
      last_failed_invoice_amount: invoice.amount_due ?? 0,
    })
    await adminDb.collection('subscriptions').doc(subscriptionId).set(
      { status: 'past_due', updated_at: new Date().toISOString() }, { merge: true }
    )
    // An ads-portal banner/sponsored subscription that lapses should stop showing.
    await setAdCampaignsBySubscription(subscriptionId, { status: 'past_due', is_active: false })
  }
  await sendDunningEmail(invoice)
}

// Updates any ads-portal campaigns AND category banners tied to a Stripe
// subscription. Two separate collections (`ad_campaigns` for newsletter
// sponsorships, `ad_banners` for category banners) both hold recurring ad
// products, and both need to stop showing when the subscription renews-fails
// or is cancelled — a category banner used to be invisible to this check
// entirely (only ad_campaigns was queried), so a cancelled banner subscriber
// kept the placement forever.
async function setAdCampaignsBySubscription(subscriptionId: string, patch: Record<string, any>) {
  if (!subscriptionId) return
  const now = new Date().toISOString()
  const [campaignsSnap, bannersSnap] = await Promise.all([
    adminDb.collection('ad_campaigns').where('stripe_subscription_id', '==', subscriptionId).get(),
    adminDb.collection('ad_banners').where('stripe_subscription_id', '==', subscriptionId).get(),
  ])
  await Promise.all([
    ...campaignsSnap.docs.map((d) => d.ref.set({ ...patch, updated_at: now }, { merge: true })),
    ...bannersSnap.docs.map((d) => d.ref.set({ ...patch, updated_at: now }, { merge: true })),
  ])
}

async function upsertSubscription(subscription: any, status?: string) {
  // Try to attribute the subscription to an advertiser via an existing purchase.
  const purchase = await findOne('ad_purchases', 'stripe_customer_id', subscription.customer || '')
  const metadata = subscription.metadata || {}
  // Attribution fields are merged CONDITIONALLY: Sales-Desk subscriptions have
  // no owner in their Stripe metadata (the admin attaches the owner later on
  // claim approval), so writing `null` here on every subscription.updated event
  // WIPED the attribution that approval had set — leaving the customer's
  // /billing page showing "no subscriptions" and the portal unable to resolve
  // their Stripe customer. Merge semantics: absent key = keep existing value.
  const advertiserId = metadata.owner_id || (purchase?.data() as any)?.advertiser_id || null
  await adminDb.collection('subscriptions').doc(subscription.id).set(
    {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer || null,
      ...(advertiserId ? { advertiser_id: advertiserId } : {}),
      ...(metadata.owner_id ? { owner_id: metadata.owner_id } : {}),
      ...(metadata.listing_id ? { listing_id: metadata.listing_id } : {}),
      ...(metadata.plan ? { plan_id: metadata.plan } : {}),
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
  await setSalesOrderBillingStatus(subscription.id, subscription.status || 'active')
}

async function handleSubscriptionDeleted(subscription: any) {
  await upsertSubscription(subscription, 'canceled')
  await setSalesOrderBillingStatus(subscription.id, 'canceled')
  // Win-back: mark when this churned customer becomes eligible for a single
  // "come back" email (sent by the daily recovery drip).
  await adminDb.collection('subscriptions').doc(subscription.id).set(
    { winback_due_at: new Date(Date.now() + 30 * 86400000).toISOString() },
    { merge: true }
  )
  await setPaymentStatusByField('stripe_subscription_id', subscription.id, 'cancelled')
  // Downgrade any directory listing tied to this subscription — including
  // dropping it from the Sponsored Listings grid, so a canceled Sponsored
  // subscriber doesn't keep the most visible placement on the site for free.
  const listing = await findOne('directory_listings', 'stripe_subscription_id', subscription.id)
  if (listing) {
    await listing.ref.set(
      {
        tier: 'basic',
        is_sponsored: false,
        pending_sponsored: null,
        // pending_tier was left set here, so approving a claim after the
        // subscription had already been cancelled re-granted the paid tier.
        pending_tier: null,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
    await disqualifyPendingReferralForListing(listing.id, 'canceled')
  }
  // Stop any ads-portal campaigns tied to this subscription.
  await setAdCampaignsBySubscription(subscription.id, { status: 'cancelled', is_active: false })

  // Reverse commission that is STILL INSIDE its 7-day hold — i.e. the customer
  // signed up and backed out almost immediately, so the sale never really stuck.
  // Deliberately does NOT claw back commission already paid on earlier billing
  // periods: the customer received those months of service, so the rep earned
  // them. Money actually returned to a customer is handled by the refund/dispute
  // path instead, which reverses paid shares too.
  const cancelOrders = await adminDb
    .collection('sales_orders')
    .where('stripe_subscription_id', '==', subscription.id)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
  for (const orderDocument of cancelOrders.docs) {
    const sessionId = (orderDocument.data() as any)?.stripe_checkout_session_id
    if (sessionId) {
      await clawbackCommission({
        sourcePaymentId: String(sessionId),
        reason: 'canceled',
        heldOnly: true,
      }).catch(() => {})
    }
  }
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
      case 'charge.dispute.created':
        await handleChargeDisputeCreated(obj)
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
    // A failing webhook means paid customers aren't being fulfilled — alert.
    await reportFailure('stripe-webhook', e, { event_type: event.type, event_id: event.id })
    // Don't mark processed — let Stripe retry.
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
  }

  await reportSuccess('stripe-webhook')
  // Mark processed only after success, so a partial failure can still be retried.
  await eventRef
    .set({ type: event.type, processed_at: new Date().toISOString() })
    .catch(() => {})

  return NextResponse.json({ received: true })
}
