import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPlan } from '@/lib/pricing'
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
  const kind = body.kind === 'custom' ? 'custom' : 'directory'
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : ''

  if (!businessName) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })

  const origin = request.headers.get('origin') || new URL(request.url).origin
  const success_url = `${origin}/en/admin/sales/new?status=success&session_id={CHECKOUT_SESSION_ID}`
  const cancel_url = `${origin}/en/admin/sales/new?status=cancel`

  try {
    if (kind === 'directory') {
      const plan = getPlan(body.plan) || getPlan('premium_monthly')!

      // Reuse an existing listing if the rep selected one, else create a fresh
      // unclaimed listing for this business (owner attached by admin on approval).
      let listingId = typeof body.listingId === 'string' && body.listingId ? body.listingId : ''
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
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: contactEmail || undefined,
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
        metadata: {
          listing_id: listingId,
          tier: plan.tier,
          plan: plan.id,
          founding: plan.founding ? 'true' : 'false',
          sold_by: user.id,
          payout_user_id: user.id,
          contact_email: contactEmail,
        },
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
      mode: 'payment',
      payment_method_types: ['card'],
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
