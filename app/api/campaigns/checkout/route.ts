import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { stripe, validateStripeKey } from '@/src/lib/stripe'

export async function POST(request: NextRequest) {
  validateStripeKey()
  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ad_campaigns')
      .select(
        `
          id,
          created_by,
          start_at,
          end_at,
          ad_placements(name, base_price)
        `
      )
      .eq('id', campaignId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (campaign.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Calculate campaign duration in days
    const startDate = new Date(campaign.start_at)
    const endDate = new Date(campaign.end_at)
    const durationDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calculate price: base_price * duration_days
    const placement = (campaign.ad_placements as any)
    const basePrice = placement?.base_price ?? 10000 // Default $100 in cents
    const totalPrice = basePrice * durationDays

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Ad Campaign: ${placement?.name || 'Campaign'}`,
              description: `${durationDays} day(s) from ${startDate.toDateString()} to ${endDate.toDateString()}`,
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/advertiser/campaigns/${campaignId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/advertiser/campaigns/${campaignId}`,
      metadata: {
        campaignId,
        userId: user.id,
      },
    })

    // Store session ID in campaign record
    if (session.id) {
      await supabase
        .from('ad_campaigns')
        .update({ stripe_session_id: session.id })
        .eq('id', campaignId)
    }

    return NextResponse.json({
      sessionId: session.id,
      clientSecret: session.client_secret,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
