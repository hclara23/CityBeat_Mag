import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { customerId, returnUrl } = await request.json()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe configuration missing' },
        { status: 500 }
      )
    }

    // Create a Stripe customer portal session
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        return_url: returnUrl || 'https://ads.citybeatmag.co/dashboard',
      }).toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Stripe portal session error:', error)
      return NextResponse.json(
        { error: 'Failed to create portal session' },
        { status: 500 }
      )
    }

    const session = (await response.json()) as { url: string }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Customer portal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
