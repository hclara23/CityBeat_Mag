import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, isAdvertiser } from '@/lib/firebase'
import { adminDb } from '@citybeat/lib/firebase/admin'

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

    let resolvedCustomerId = customerId as string | undefined

    if (resolvedCustomerId) {
      const purchasesSnapshot = await adminDb
        .collection('ad_purchases')
        .where('advertiser_id', '==', userId)
        .where('stripe_customer_id', '==', resolvedCustomerId)
        .limit(1)
        .get()

      if (purchasesSnapshot.empty) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 403 })
      }
    }

    if (!resolvedCustomerId) {
      const subsSnapshot = await adminDb
        .collection('subscriptions')
        .where('advertiser_id', '==', userId)
        .orderBy('created_at', 'desc')
        .get()
        
      const sub = subsSnapshot.docs.find(d => !!d.data().stripe_customer_id)

      resolvedCustomerId = sub?.data()?.stripe_customer_id || undefined
    }

    if (!resolvedCustomerId) {
      const purchasesSnapshot = await adminDb
        .collection('ad_purchases')
        .where('advertiser_id', '==', userId)
        .orderBy('created_at', 'desc')
        .get()

      const purchase = purchasesSnapshot.docs.find(d => !!d.data().stripe_customer_id)

      resolvedCustomerId = purchase?.data()?.stripe_customer_id || undefined
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
