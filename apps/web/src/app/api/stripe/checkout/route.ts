import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with a fallback key for development if env var is missing
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
})

export async function POST(req: Request) {
  try {
    const { productId, type, returnUrl } = await req.json()

    if (stripeSecretKey === 'sk_test_placeholder') {
      console.warn('Using placeholder Stripe key. Configure STRIPE_SECRET_KEY in production.')
    }

    // Default prices
    let unitAmount = 5000 // $50.00 default for jobs
    let name = 'Job Posting - 30 Days'

    if (type === 'ad_campaign') {
      unitAmount = 15000 // $150.00 default for ads
      name = 'Featured Ad Campaign'
    }

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name,
              metadata: {
                productId,
                type,
              }
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.statusCode || 500 }
    )
  }
}
