import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserIdFromRequest, isAdvertiser } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { customerId, returnUrl } = await request.json()

    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe configuration missing' },
        { status: 500 }
      )
    }

    const supabase = getSupabaseAdmin()
    let resolvedCustomerId = customerId as string | undefined

    if (resolvedCustomerId) {
      const { data: matches, error } = await supabase
        .from('ad_purchases')
        .select('id')
        .eq('advertiser_id', userId)
        .eq('stripe_customer_id', resolvedCustomerId)
        .limit(1)

      if (error || !matches || matches.length === 0) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 403 })
      }
    }

    if (!resolvedCustomerId) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('advertiser_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      resolvedCustomerId = subscription?.stripe_customer_id || undefined
    }

    if (!resolvedCustomerId) {
      const { data: purchase } = await supabase
        .from('ad_purchases')
        .select('stripe_customer_id')
        .eq('advertiser_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      resolvedCustomerId = purchase?.stripe_customer_id || undefined
    }

    if (!resolvedCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found for customer portal' },
        { status: 404 }
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
        customer: resolvedCustomerId,
        return_url: returnUrl || 'https://citybeatmag.co/ads/campaigns',
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
