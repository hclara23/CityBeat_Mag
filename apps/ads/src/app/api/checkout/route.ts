import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.STRIPE_SECRET_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

interface CheckoutRequest {
  campaignId: string
  adType: string
  billingCycle: string
  amount: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequest
    const { campaignId, adType, billingCycle, amount } = body

    if (!campaignId || !adType || !billingCycle || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Get user session from request
    // const user = await getUserFromSession(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

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
      customer_email: '',
      metadata: {
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
