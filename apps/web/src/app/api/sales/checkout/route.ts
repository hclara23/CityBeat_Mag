import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPlan } from '@/lib/pricing'
import {
  blocksReplacementSubscription,
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringCheckoutDefaults,
  recurringCustomerParams,
  recurringEmailError,
  salesCheckoutKind,
} from '@/lib/sales-checkout'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Sales rep "virtual checkout" — generates a Stripe Checkout link a rep can hand
// to a business on the spot (door-to-door). The sale is attributed to the rep via
// metadata.payout_user_id so commission pays out per the godmode payout settings.
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
  const kind = salesCheckoutKind(body.kind)
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  const contactEmail = normalizeSalesEmail(body.contactEmail)
  const checkoutLocale = body.locale === 'es' ? 'es' : 'en'

  if (!businessName) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  const emailError = recurringEmailError(kind, contactEmail)
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 })

  const origin = request.headers.get('origin') || new URL(request.url).origin
  const billingType = kind === 'directory' ? 'recurring' : 'one_time'
  const resultUrl = `${origin}/${checkoutLocale}/checkout/result`
  const success_url = `${resultUrl}?status=success&billing=${billingType}&session_id={CHECKOUT_SESSION_ID}`
  const cancel_url = `${resultUrl}?status=cancel&billing=${billingType}`

  try {
    if (kind === 'directory') {
      const plan = getPlan(body.plan) || getPlan('premium_monthly')!

      // Reuse an existing listing if the rep selected one, else create a fresh
      // unclaimed listing for this business (owner attached by admin on approval).
      let listingId = typeof body.listingId === 'string' && body.listingId ? body.listingId : ''
      let listing: Record<string, any> | null = null
      if (listingId) {
        const listingDoc = await adminDb.collection('directory_listings').doc(listingId).get()
        if (!listingDoc.exists) {
          return NextResponse.json({ error: 'Directory listing not found' }, { status: 404 })
        }
        listing = listingDoc.data() as Record<string, any>

        const existingSubscriptionId =
          typeof listing.stripe_subscription_id === 'string' ? listing.stripe_subscription_id : ''
        if (existingSubscriptionId) {
          try {
            const existingSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId)
            if (blocksReplacementSubscription(existingSubscription.status)) {
              return NextResponse.json(
                {
                  error:
                    'This listing already has a subscription. Use the customer billing portal to update its saved card instead of creating another subscription.',
                  code: 'subscription_already_exists',
                },
                { status: 409 }
              )
            }
          } catch (error: any) {
            // A stale deleted Stripe id should not permanently block a legitimate
            // reactivation. Every other Stripe failure remains fatal.
            if (error?.code !== 'resource_missing' && error?.raw?.code !== 'resource_missing') throw error
          }
        }
      }
      if (!listingId) {
        const ref = await adminDb.collection('directory_listings').add({
          name: businessName,
          contact_email: contactEmail || null,
          claim_status: 'unclaimed',
          tier: 'basic',
          sold_by_rep: user.id,
          source: 'sales_rep',
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        })
        listingId = ref.id
        listing = { contact_email: contactEmail }
      }

      // Passing a validated existing Customer lets Stripe prefill its saved card,
      // billing name, address, and email. Never reuse a Customer for a different
      // email: a rep could otherwise expose masked payment details to the wrong
      // recipient. First-time customers get their email prefilled instead.
      const customerParams = recurringCustomerParams({
        customerId: listing?.stripe_customer_id,
        listingEmail: listing?.contact_email,
        contactEmail,
      })

      const checkoutMetadata: Record<string, string> = {
        listing_id: listingId,
        tier: plan.tier,
        plan: plan.id,
        founding: plan.founding ? 'true' : 'false',
        billing_cycle: plan.interval,
        sold_by: user.id,
        payout_user_id: user.id,
        contact_email: contactEmail,
      }

      const session = await stripe.checkout.sessions.create({
        ...recurringCheckoutDefaults(plan.priceLabel, plan.interval),
        client_reference_id: listingId,
        ...customerParams,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: plan.unitAmount,
              recurring: { interval: plan.interval },
              product_data: {
                name: `CityBeat Directory ${plan.label}: ${businessName}`,
                description: plan.description,
              },
            },
          },
        ],
        success_url,
        cancel_url,
        metadata: checkoutMetadata,
        subscription_data: { metadata: checkoutMetadata },
      })

      return NextResponse.json({ url: session.url, listingId, priceLabel: plan.priceLabel })
    }

    // kind === 'custom' — a one-off charge for an ad/banner/sponsored/anything sold
    // in the field. Recorded as an ad_purchase by the webhook + rep commission.
    const dollars = Number(body.amount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }
    const description = typeof body.description === 'string' ? body.description.slice(0, 300) : 'CityBeat advertising'

    const session = await stripe.checkout.sessions.create({
      ...oneTimeCheckoutDefaults(),
      customer_email: contactEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(dollars * 100),
            product_data: { name: `CityBeat: ${businessName}`, description },
          },
        },
      ],
      success_url,
      cancel_url,
      metadata: {
        adType: 'field_sale',
        companyName: businessName,
        sold_by: user.id,
        payout_user_id: user.id,
        contact_email: contactEmail,
        description,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not create checkout' }, { status: 400 })
  }
}
