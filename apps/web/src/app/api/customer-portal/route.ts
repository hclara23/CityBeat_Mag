import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()

  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // Route handlers do not need to write refreshed cookies for these reads.
    },
  }
}

function sameOriginReturnUrl(value: unknown, request: NextRequest) {
  const fallback = new URL('/billing', request.nextUrl.origin)

  if (typeof value !== 'string' || !value.trim()) {
    return fallback.toString()
  }

  try {
    const parsed = new URL(value, request.nextUrl.origin)
    return parsed.origin === request.nextUrl.origin ? parsed.toString() : fallback.toString()
  } catch {
    return fallback.toString()
  }
}

export async function POST(request: NextRequest) {
  const { customerId, returnUrl } = await request.json()
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: 'Stripe configuration missing' },
      { status: 500 }
    )
  }

  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(cookieStore)
  let resolvedCustomerId = typeof customerId === 'string' ? customerId : undefined

  if (resolvedCustomerId) {
    const { data: subscriptionMatches, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('advertiser_id', user.id)
      .eq('stripe_customer_id', resolvedCustomerId)
      .limit(1)

    if (subscriptionError) {
      return NextResponse.json(
        { error: 'Failed to validate billing account' },
        { status: 500 }
      )
    }

    const { data: purchaseMatches, error: purchaseError } = await supabase
      .from('ad_purchases')
      .select('id')
      .eq('advertiser_id', user.id)
      .eq('stripe_customer_id', resolvedCustomerId)
      .limit(1)

    if (purchaseError) {
      return NextResponse.json(
        { error: 'Failed to validate billing account' },
        { status: 500 }
      )
    }

    if (!subscriptionMatches?.length && !purchaseMatches?.length) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 403 })
    }
  }

  if (!resolvedCustomerId) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('advertiser_id', user.id)
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
      .eq('advertiser_id', user.id)
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

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: resolvedCustomerId,
      return_url: sameOriginReturnUrl(returnUrl, request),
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
}
