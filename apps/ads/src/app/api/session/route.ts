import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent'],
    })

    return NextResponse.json({
      id: session.id,
      customer_email: session.customer_email,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      status: session.status,
      ad_type: session.metadata?.adType,
      company_name: session.metadata?.companyName,
      billing_cycle: session.metadata?.billingCycle,
      line_items: session.line_items?.data.map((item: any) => ({
        product_name: item.description,
        amount: item.amount_total,
        quantity: item.quantity,
      })),
    })
  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
