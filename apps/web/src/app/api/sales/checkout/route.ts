import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FOUNDING_LIMIT, getPlan } from '@/lib/pricing'
import {
  resolveSalesProductRequest,
  salesProductAmount,
  salesProductPriceLabel,
} from '@/lib/sales-products'
import {
  buildSalesOrderRecord,
  createSalesOrderAccess,
  salesOrderCheckoutUrls,
  salesOrderStripeMetadata,
} from '@/lib/sales-orders'
import {
  blocksReplacementSubscription,
  isValidSalesEmail,
  resolveDirectoryCategory,
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringCheckoutDefaults,
  recurringCustomerParams,
} from '@/lib/sales-checkout'
import {
  buildSalesDirectoryListingRecord,
  salesDirectoryListingUrl,
} from '@/lib/sales-directory'
import { getClientIp } from '@/lib/auth-security'
import {
  validateBypass,
  mintClaimToken,
  claimTokenExpiresAt,
  buildVerificationAuditRecord,
  type AttestationMethod,
} from '@/lib/verification-audit'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function foundingOfferAvailable() {
  try {
    const [listingCount, monthlyOrders, annualOrders] = await Promise.all([
      adminDb
        .collection('directory_listings')
        .where('founding_member', '==', true)
        .count()
        .get()
        .then((snapshot: any) => snapshot.data().count),
      adminDb.collection('sales_orders').where('product_id', '==', 'directory_founding_monthly').get(),
      adminDb.collection('sales_orders').where('product_id', '==', 'directory_founding_annual').get(),
    ])
    const paidAwaitingListing = [...monthlyOrders.docs, ...annualOrders.docs].filter((document) => {
      const order = document.data()
      return order.payment_status === 'paid' && !order.fulfillment_target
    }).length
    return listingCount + paidAwaitingListing < FOUNDING_LIMIT
  } catch (error) {
    console.error('Could not confirm Founding availability:', error)
    return false
  }
}

async function existingDirectoryListing(input: {
  listingId: string
  stripe: Stripe
}) {
  if (!input.listingId) return null

  const listingDoc = await adminDb.collection('directory_listings').doc(input.listingId).get()
  if (!listingDoc.exists) throw Object.assign(new Error('Directory listing not found'), { status: 404 })
  const listing = listingDoc.data() as Record<string, unknown>
  const existingOrders = await adminDb.collection('sales_orders').where('listing_id', '==', input.listingId).get()
  const hasBlockingOrder = existingOrders.docs.some((document) => {
    const order = document.data()
    if (order.billing_type !== 'subscription') return false
    if (order.payment_status === 'refunded' || ['canceled', 'refunded'].includes(order.billing_status)) return false
    const expiresAt = Date.parse(order.checkout_expires_at || '')
    const createdAt = Date.parse(order.created_at || '')
    const readyAndOpen =
      order.checkout_status === 'ready' &&
      (Number.isFinite(expiresAt) ? expiresAt > Date.now() : Number.isFinite(createdAt) && createdAt + 24 * 60 * 60 * 1000 > Date.now())
    return readyAndOpen || order.checkout_status === 'completed' || order.payment_status === 'paid'
  })
  if (hasBlockingOrder) {
    throw Object.assign(
      new Error('This listing already has an active or pending Sales Desk subscription.'),
      { status: 409, code: 'subscription_already_exists' }
    )
  }
  const existingSubscriptionId =
    typeof listing.stripe_subscription_id === 'string' ? listing.stripe_subscription_id : ''

  if (existingSubscriptionId) {
    try {
      const subscription = await input.stripe.subscriptions.retrieve(existingSubscriptionId)
      if (blocksReplacementSubscription(subscription.status)) {
        throw Object.assign(
          new Error(
            'This listing already has a subscription. Use the customer billing portal to update its saved card.'
          ),
          { status: 409, code: 'subscription_already_exists' }
        )
      }
    } catch (error: any) {
      if (error?.code !== 'resource_missing' && error?.raw?.code !== 'resource_missing') throw error
    }
  }

  return listing
}

// Creates one server-priced order and one Stripe Checkout Session. The customer
// returns to an order-specific intake wizard after payment; no card data ever
// passes through CityBeat.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const product = resolveSalesProductRequest({ productId: body.productId, kind: body.kind, plan: body.plan })
  if (!product) return NextResponse.json({ error: 'Choose a valid product' }, { status: 400 })
  const requiresCheckout = product.billing !== 'free'
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (requiresCheckout && !stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }
  const stripe = requiresCheckout
    ? new Stripe(stripeSecretKey!, { apiVersion: '2023-08-16' })
    : null

  const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 140) : ''
  const contactEmail = normalizeSalesEmail(body.contactEmail)
  const contactPhone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
  const locale = body.locale === 'es' ? 'es' : 'en'
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const amount = salesProductAmount(product, body.amount)
  const customDescription =
    typeof body.description === 'string' ? body.description.trim().slice(0, 300) : ''

  if (!businessName) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  if (!contactEmail) return NextResponse.json({ error: 'Client email is required' }, { status: 400 })
  if (!isValidSalesEmail(contactEmail)) {
    return NextResponse.json({ error: 'Enter a valid client email' }, { status: 400 })
  }
  if (amount === null) {
    return NextResponse.json({ error: 'Custom amount must be between $1 and $100,000' }, { status: 400 })
  }
  if (product.id === 'custom_one_time' && !customDescription) {
    return NextResponse.json({ error: 'Describe the approved custom product' }, { status: 400 })
  }
  if (product.billing === 'free' && product.id !== 'directory_basic_free') {
    return NextResponse.json({ error: 'Choose a valid free listing product' }, { status: 400 })
  }
  if (product.id === 'directory_basic_free' && body.listingId) {
    return NextResponse.json(
      { error: 'Basic Free is for a new business. The selected listing already exists.' },
      { status: 409 }
    )
  }
  if (product.founding && !(await foundingOfferAvailable())) {
    return NextResponse.json(
      { error: 'The Founding 100 launch offer is sold out. Please choose another plan.', founding_sold_out: true },
      { status: 409 }
    )
  }

  // Salesperson verification bypass (opt-in, default off). Only an authenticated
  // sales/developer caller reaches here (public callers were 403'd above), so a
  // public user can never set or forge it. It is valid ONLY when creating a
  // brand-new directory listing — never for a merge or a pre-existing listing.
  const bypassRequested = body.bypassVerification === true
  let bypassFields: Record<string, unknown> | null = null
  let bypassToken: string | null = null
  let bypassAudit: { method: AttestationMethod; note: string } | null = null
  if (bypassRequested) {
    if (product.family !== 'directory') {
      return NextResponse.json({ error: 'Verification bypass only applies to directory listings.' }, { status: 400 })
    }
    if (typeof body.listingId === 'string' && body.listingId.trim()) {
      return NextResponse.json(
        { error: 'Verification bypass is only available when creating a new listing.' },
        { status: 400 }
      )
    }
    const check = validateBypass({
      attestationMethod: body.attestationMethod,
      attestationAccepted: body.attestationAccepted,
      customerEmail: contactEmail,
      attestationNote: body.attestationNote,
    })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
    const { token, hash } = mintClaimToken()
    bypassToken = token
    bypassAudit = { method: check.method, note: check.note }
    bypassFields = {
      verification_path: 'salesperson_attestation',
      claim_token_hash: hash,
      claim_token_expires_at: claimTokenExpiresAt(Date.now()),
      claim_token_consumed_at: null,
    }
  }

  // Immutable audit row. Awaited BEFORE the listing is written and never
  // swallowed, so a bypassed listing can never exist without its audit trail.
  // The note/IP/salesperson id live only here, never on the public listing.
  const writeBypassAudit = async (listingId: string) => {
    if (!bypassRequested || !bypassAudit) return
    const record = buildVerificationAuditRecord({
      listingId,
      salespersonId: user.id,
      salespersonEmail: user.email || (profile?.email as string | undefined) || 'unknown',
      method: bypassAudit.method,
      note: bypassAudit.note,
      customerEmail: contactEmail,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      now: new Date().toISOString(),
    })
    await adminDb.collection('directory_verification_audits').add(record)
  }

  let orderRef: FirebaseFirestore.DocumentReference | null = null

  try {
    let listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
    let listing: Record<string, unknown> | null = null
    if (product.family === 'directory' && product.billing !== 'free') {
      listing = await existingDirectoryListing({
        listingId,
        stripe: stripe!,
      })
    }
    const directoryCategory =
      product.family === 'directory'
        ? resolveDirectoryCategory({
            requestedCategory: body.directoryCategory,
            listingCategory: listing?.category,
          })
        : ''
    if (product.family === 'directory' && !directoryCategory) {
      return NextResponse.json(
        { error: 'Choose a directory category or type a new one.' },
        { status: 400 }
      )
    }

    if (product.id === 'directory_basic_free') {
      const listingRef = adminDb.collection('directory_listings').doc()
      const listingUrl = salesDirectoryListingUrl({
        origin: appOrigin,
        locale,
        listingId: listingRef.id,
      })
      await writeBypassAudit(listingRef.id)
      await listingRef.set({
        ...buildSalesDirectoryListingRecord({
          businessName,
          category: directoryCategory,
          contactEmail,
          contactPhone,
          locale,
          sellerUserId: user.id,
          productId: product.id,
        }),
        ...(bypassFields || {}),
      })
      const bypassClaimUrl = bypassToken
        ? `${listingUrl}/claim?accept=${encodeURIComponent(bypassToken)}`
        : null
      return NextResponse.json(
        {
          url: null,
          checkoutRequired: false,
          orderId: null,
          listingId: listingRef.id,
          listingUrl,
          listingCreated: true,
          productId: product.id,
          priceLabel: product.priceLabel,
          billing: product.billing,
          bypass: bypassRequested,
          bypassClaimUrl,
        },
        { status: 201 }
      )
    }

    const sellerCreatedListing =
      product.family === 'directory' && listing?.sales_created_by === user.id
    if (sellerCreatedListing && listingId && listing?.claim_status === 'unclaimed') {
      await adminDb.collection('directory_listings').doc(listingId).set(
        {
          name: businessName,
          category: directoryCategory,
          email: contactEmail,
          contact_email: contactEmail,
          phone: contactPhone || null,
          requested_product_id: product.id,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )
    }

    const access = createSalesOrderAccess()
    orderRef = adminDb.collection('sales_orders').doc()
    const listingPreexisting = Boolean(listingId)
    if (product.family === 'directory' && !listingId) listingId = orderRef.id
    await orderRef.set(
      buildSalesOrderRecord({
        product,
        amount,
        businessName,
        contactEmail,
        contactPhone,
        locale,
        sellerUserId: user.id,
        listingId,
        directoryCategory,
        listingPreexisting,
        customDescription,
        tokenHash: access.tokenHash,
      })
    )
    const listingCreated = product.family === 'directory' && !listingPreexisting
    const listingUrl = listingCreated || sellerCreatedListing
      ? salesDirectoryListingUrl({
          origin: appOrigin,
          locale,
          listingId,
        })
      : null
    if (listingCreated) {
      await writeBypassAudit(listingId)
      await adminDb.collection('directory_listings').doc(listingId).set({
        ...buildSalesDirectoryListingRecord({
          businessName,
          category: directoryCategory,
          contactEmail,
          contactPhone,
          locale,
          sellerUserId: user.id,
          productId: product.id,
          orderId: orderRef.id,
        }),
        ...(bypassFields || {}),
      })
    }
    const bypassClaimUrl =
      bypassToken && listingUrl ? `${listingUrl}/claim?accept=${encodeURIComponent(bypassToken)}` : null

    const urls = salesOrderCheckoutUrls({
      origin: appOrigin,
      locale,
      orderId: orderRef.id,
      token: access.token,
      billing: product.billing === 'subscription' ? 'subscription' : 'one_time',
    })
    const sharedMetadata = salesOrderStripeMetadata({
      orderId: orderRef.id,
      product,
      sellerUserId: user.id,
      contactEmail,
      businessName,
      listingId,
    })
    const directoryPlan = product.directoryPlanId ? getPlan(product.directoryPlanId) : null
    const metadata: Record<string, string> = {
      ...sharedMetadata,
      ...(directoryPlan
        ? {
            tier: directoryPlan.tier,
            plan: directoryPlan.id,
            founding: directoryPlan.founding ? 'true' : 'false',
            billing_cycle: directoryPlan.interval,
            directory_category: directoryCategory,
            listing_preexisting: listingPreexisting ? 'true' : 'false',
          }
        : {
            adType: product.intakeKind,
            description: customDescription || product.description,
          }),
    }
    const priceLabel = salesProductPriceLabel(product, amount)
    const customerParams =
      product.billing === 'subscription'
        ? product.family === 'directory'
          ? recurringCustomerParams({
              customerId: listing?.stripe_customer_id,
              listingEmail: listing?.contact_email,
              contactEmail,
            })
          : { customer_email: contactEmail }
        : { customer_email: contactEmail }

    const session = await stripe!.checkout.sessions.create({
      ...(product.billing === 'subscription'
        ? recurringCheckoutDefaults(priceLabel, product.interval || 'month')
        : oneTimeCheckoutDefaults()),
      ...customerParams,
      client_reference_id: orderRef.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            ...(product.billing === 'subscription'
              ? { recurring: { interval: product.interval || 'month' } }
              : {}),
            product_data: {
              name: `CityBeat ${product.shortName}: ${businessName}`,
              description: customDescription || product.description,
            },
          },
        },
      ],
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata,
      ...(product.billing === 'subscription' ? { subscription_data: { metadata } } : {}),
    })

    await orderRef.set(
      {
        checkout_status: 'ready',
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        checkout_expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )

    return NextResponse.json({
      url: session.url,
      checkoutRequired: true,
      orderId: orderRef.id,
      listingId: listingId || null,
      listingUrl,
      listingCreated,
      productId: product.id,
      priceLabel,
      billing: product.billing,
      bypass: bypassRequested,
      bypassClaimUrl,
    })
  } catch (error: any) {
    if (orderRef) {
      await orderRef
        .set(
          {
            checkout_status: 'failed',
            checkout_error: String(error?.message || 'Could not create checkout').slice(0, 300),
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        )
        .catch(() => {})
    }
    return NextResponse.json(
      { error: error?.message || 'Could not create checkout', code: error?.code },
      { status: Number(error?.status) || 400 }
    )
  }
}
