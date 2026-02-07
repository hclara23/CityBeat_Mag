import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUserIdFromRequest, isAdvertiser } from '@/lib/supabase'
import { getPrice, type AdType, type BillingCycle } from '@/lib/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16',
})

interface CheckoutRequest {
  campaignId: string
  adType: string
  billingCycle: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequest
    const { campaignId, adType, billingCycle } = body

    if (!campaignId || !adType || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let amount: number
    try {
      amount = getPrice(adType as AdType, billingCycle as BillingCycle)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid pricing selection' },
        { status: 400 }
      )
    }

    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: billingCycle === 'perpost' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${adType.charAt(0).toUpperCase() + adType.slice(1)} Campaign`,
              description: `Campaign ID: ${campaignId}`,
            },
            unit_amount: amount,
            ...(billingCycle !== 'perpost' && {
              recurring: {
                interval:
                  billingCycle === 'monthly'
                    ? 'month'
                    : billingCycle === 'quarterly'
                      ? 'month'
                      : 'year',
                interval_count:
                  billingCycle === 'quarterly' ? 3 : billingCycle === 'yearly' ? 12 : 1,
              },
            }),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/success?campaign_id=${campaignId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/campaigns`,
      metadata: {
        advertiserId: userId,
        campaignId,
        adType,
        billingCycle,
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
