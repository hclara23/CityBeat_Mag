import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getUserIdFromRequest, isAdvertiser } from '@/lib/firebase'
import { getPrice, type AdType, type BillingCycle } from '@/lib/pricing'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? ''
const stripe = new Stripe(stripeSecret, { apiVersion: '2023-08-16' })

const AD_TYPES: AdType[] = ['newsletter', 'sponsored', 'banner']
const BILLING_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'yearly', 'perpost']

// Recurring config per billing cycle. `perpost` is a one-time payment.
const RECURRING: Record<BillingCycle, { interval: 'month' | 'year'; interval_count: number } | null> = {
  monthly: { interval: 'month', interval_count: 1 },
  quarterly: { interval: 'month', interval_count: 3 },
  yearly: { interval: 'year', interval_count: 1 },
  perpost: null,
}

// Creates a Stripe Checkout session for an already-created ad campaign.
// Payload: { campaignId, adType, billingCycle, locale }. The webhook keys off
// metadata.campaign_id to activate the campaign and publish its banner.
export async function POST(req: NextRequest) {
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await isAdvertiser(userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaignId, adType, billingCycle, locale } = body
  if (!campaignId || !adType || !billingCycle) {
    return NextResponse.json(
      { error: 'Missing required fields: campaignId, adType, billingCycle' },
      { status: 400 }
    )
  }
  if (!AD_TYPES.includes(adType) || !BILLING_CYCLES.includes(billingCycle)) {
    return NextResponse.json({ error: 'Invalid adType or billingCycle' }, { status: 400 })
  }

  let amount: number
  try {
    amount = getPrice(adType as AdType, billingCycle as BillingCycle)
  } catch {
    return NextResponse.json({ error: 'Unsupported pricing selection' }, { status: 400 })
  }

  // Load the campaign and verify ownership before charging.
  const ref = adminDb.collection('ad_campaigns').doc(campaignId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  const campaign = snap.data() as any
  if (campaign.advertiser_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const recurring = RECURRING[billingCycle as BillingCycle]
  const loc = locale === 'es' ? 'es' : 'en'
  const origin =
    req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const formPath = adType === 'banner' ? 'banners' : adType // banners | newsletter | sponsored

  try {
    const session = await stripe.checkout.sessions.create({
      mode: recurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            ...(recurring ? { recurring } : {}),
            product_data: {
              name: `CityBeat ${adType} ad — ${campaign.name || 'Campaign'} (${billingCycle})`,
            },
          },
        },
      ],
      success_url: `${origin}/${loc}/orders?status=success&campaign=${campaignId}`,
      cancel_url: `${origin}/${loc}/${formPath}?status=cancel`,
      metadata: {
        campaign_id: campaignId,
        ad_type: adType,
        billing_cycle: billingCycle,
      },
    })

    await ref.update({
      stripe_session_id: session.id,
      amount_cents: amount,
      updated_at: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ session_id: session.id, url: session.url }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Checkout failed' }, { status: 400 })
  }
}
