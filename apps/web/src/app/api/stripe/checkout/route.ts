import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Only allow same-origin return URLs — an attacker-controlled returnUrl would make
// Stripe redirect the payer to a phishing page after checkout (open redirect).
function sameOriginReturn(value: unknown, origin: string, fallbackPath: string): string {
  const fallback = `${origin}${fallbackPath}`
  if (typeof value !== 'string' || !value.trim()) return fallback
  try {
    const parsed = new URL(value, origin)
    return parsed.origin === origin ? parsed.toString() : fallback
  } catch {
    return fallback
  }
}

export async function POST(req: NextRequest) {
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })

  // Throttle — this creates real Stripe sessions on each call.
  const rl = await checkRateLimit(`checkout:ip:${getClientIp(req)}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  try {
    const { productId, type, returnUrl } = await req.json()

    // Server sets the price by product type — never trusts a client amount.
    let unitAmount = 5000 // $50.00 default for jobs
    let name = 'Job Posting - 30 Days'
    if (type === 'ad_campaign') {
      unitAmount = 15000 // $150.00 default for ads
      name = 'Featured Ad Campaign'
    }

    const origin = req.headers.get('origin') || new URL(req.url).origin
    const base = sameOriginReturn(returnUrl, origin, '/en/ads/success')
    const sep = base.includes('?') ? '&' : '?'

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name, metadata: { productId: String(productId ?? ''), type: String(type ?? '') } },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${base}${sep}success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${sep}canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 })
  }
}
