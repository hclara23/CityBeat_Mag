import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function sameOriginReturnUrl(value: unknown, request: NextRequest) {
  const fallback = new URL('/billing', request.nextUrl.origin)
  if (typeof value !== 'string' || !value.trim()) return fallback.toString()
  try {
    const parsed = new URL(value, request.nextUrl.origin)
    return parsed.origin === request.nextUrl.origin ? parsed.toString() : fallback.toString()
  } catch {
    return fallback.toString()
  }
}

async function firstCustomerId(collection: string, userId: string): Promise<string | undefined> {
  const snap = await adminDb
    .collection(collection)
    .where('advertiser_id', '==', userId)
    .get()
    .catch(() => ({ docs: [] as any[] }))
  const ids = (snap.docs as any[])
    .map((d) => (d.data() as any).stripe_customer_id)
    .filter((v) => typeof v === 'string' && v)
  return ids[0]
}

export async function POST(request: NextRequest) {
  const { customerId, returnUrl } = await request.json()
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let resolvedCustomerId = typeof customerId === 'string' ? customerId : undefined

  // If a customerId was supplied, verify it belongs to this user.
  if (resolvedCustomerId) {
    const [subMatch, purchaseMatch] = await Promise.all([
      firstCustomerId('subscriptions', user.id),
      firstCustomerId('ad_purchases', user.id),
    ])
    const profile = await getServerUserProfile(user.id)
    const owned = [subMatch, purchaseMatch, profile?.stripe_customer_id].filter(Boolean)
    if (!owned.includes(resolvedCustomerId)) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 403 })
    }
  }

  // Otherwise resolve from subscriptions, then ad_purchases, then profile.
  if (!resolvedCustomerId) resolvedCustomerId = await firstCustomerId('subscriptions', user.id)
  if (!resolvedCustomerId) resolvedCustomerId = await firstCustomerId('ad_purchases', user.id)
  if (!resolvedCustomerId) {
    const profile = await getServerUserProfile(user.id)
    resolvedCustomerId = profile?.stripe_customer_id || undefined
  }

  if (!resolvedCustomerId) {
    return NextResponse.json({ error: 'No billing account found for customer portal' }, { status: 404 })
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
    const error = await response.json().catch(() => ({}))
    console.error('Stripe portal session error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }

  const session = (await response.json()) as { url: string }
  return NextResponse.json({ url: session.url })
}
