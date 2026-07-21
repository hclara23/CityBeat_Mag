import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { FOUNDING_LIMIT, getPlan } from '@/lib/pricing'
import {
  getSalesProduct,
  legacySalesProductId,
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
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringCheckoutDefaults,
  recurringCustomerParams,
} from '@/lib/sales-checkout'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function foundingOfferAvailable() {
  const count = await adminDb
    .collection('directory_listings')
    .where('founding_member', '==', true)
    .count()
    .get()
    .then((snapshot: any) => snapshot.data().count)
    .catch(() => 0)
  return count < FOUNDING_LIMIT
}

async function reusableDirectoryListing(input: {
  listingId: string
  businessName: string
  contactEmail: string
  sellerUserId: string
  stripe: Stripe
}) {
  if (!input.listingId) {
    const ref = await adminDb.collection('directory_listings').add({
      name: input.businessName,
      contact_email: input.contactEmail,
      claim_status: 'unclaimed',
      tier: 'basic',
      sold_by_rep: input.sellerUserId,
      source: 'sales_rep',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })
    return { id: ref.id, data: { contact_email: input.contactEmail } as Record<string, unknown> }
  }

  const listingDoc = await adminDb.collection('directory_listings').doc(input.listingId).get()
  if (!listingDoc.exists) throw Object.assign(new Error('Directory listing not found'), { status: 404 })
  const listing = listingDoc.data() as Record<string, unknown>
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

  return { id: input.listingId, data: listing }
}

// Creates one server-priced order and one Stripe Checkout Session. The customer
// returns to an order-specific intake wizard after payment; no card data ever
// passes through CityBeat.
export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const product =
    getSalesProduct(body.productId) || getSalesProduct(legacySalesProductId(body.kind, body.plan))
  if (!product) return NextResponse.json({ error: 'Choose a valid product' }, { status: 400 })

  const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, 140) : ''
  const contactEmail = normalizeSalesEmail(body.contactEmail)
  const contactPhone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
  const locale = body.locale === 'es' ? 'es' : 'en'
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
  if (product.founding && !(await foundingOfferAvailable())) {
    return NextResponse.json(
      { error: 'The Founding 100 launch offer is sold out. Please choose another plan.', founding_sold_out: true },
      { status: 409 }
    )
  }

  let orderRef: FirebaseFirestore.DocumentReference | null = null

  try {
    let listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
    let listing: Record<string, unknown> | null = null
    if (product.family === 'directory') {
      const result = await reusableDirectoryListing({
        listingId,
        businessName,
        contactEmail,
        sellerUserId: user.id,
        stripe,
      })
      listingId = result.id
      listing = result.data
    }

    const access = createSalesOrderAccess()
    orderRef = adminDb.collection('sales_orders').doc()
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
        customDescription,
        tokenHash: access.tokenHash,
      })
    )

    const urls = salesOrderCheckoutUrls({
      origin: new URL(request.url).origin,
      locale,
      orderId: orderRef.id,
      token: access.token,
      billing: product.billing,
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

    const session = await stripe.checkout.sessions.create({
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
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )

    return NextResponse.json({
      url: session.url,
      orderId: orderRef.id,
      listingId: listingId || null,
      productId: product.id,
      priceLabel,
      billing: product.billing,
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
