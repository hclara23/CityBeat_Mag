import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { adminDb } from '@citybeat/lib/firebase/admin'

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

    // Strict allowlist. `type` used to fall through to job pricing for ANY
    // unrecognised value, so a typo or a crafted value charged the customer $50
    // and then provisioned nothing — the webhook only acts on 'job' or
    // 'ad_campaign'. Charging for something we cannot fulfil is a money bug.
    const PRICING: Record<string, { collection: string; unitAmount: number; name: string }> = {
      job: { collection: 'jobs', unitAmount: 5000, name: 'Job Posting - 30 Days' },
      ad_campaign: { collection: 'campaigns', unitAmount: 15000, name: 'Featured Ad Campaign' },
    }
    const plan = PRICING[String(type ?? '')]
    if (!plan) {
      return NextResponse.json({ error: 'Unknown product type.' }, { status: 400 })
    }

    // A doc id with a '/' addresses a SUBcollection; reject anything that is not
    // a plain id before it can reach a Firestore path.
    const docId = String(productId ?? '')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(docId)) {
      return NextResponse.json({ error: 'Invalid product.' }, { status: 400 })
    }

    // The draft must already exist and still be unpaid. This flow is anonymous
    // by design (you can post a job without an account), so the draft's own
    // existence is the only thing tying a payment to something real. Without
    // this check the webhook's merge-write would CREATE whatever id it was
    // handed, letting a payer inject published documents into public
    // collections — and it also stops us charging for an already-paid item.
    const draftSnap = await adminDb.collection(plan.collection).doc(docId).get()
    if (!draftSnap.exists) {
      return NextResponse.json({ error: 'That item no longer exists.' }, { status: 404 })
    }
    if ((draftSnap.data() as any)?.payment_status === 'paid') {
      return NextResponse.json({ error: 'That item is already paid for.' }, { status: 409 })
    }

    const unitAmount = plan.unitAmount
    const name = plan.name

    const origin = req.headers.get('origin') || new URL(req.url).origin
    const base = sameOriginReturn(returnUrl, origin, '/en/ads/success')
    const sep = base.includes('?') ? '&' : '?'

    // Fulfillment metadata MUST reach the webhook. It previously lived ONLY on
    // `product_data.metadata` — which Stripe stores on the PRODUCT — while the
    // webhook reads `session.metadata` and falls back to
    // `line_items[0].price.metadata`. Neither ever contained it, so the
    // provisioning branch never fired: a paid $50 job posting stayed an
    // unpublished draft forever. Stripe's inline price_data has no metadata
    // field, so the session is the reliable carrier; product_data.metadata is
    // kept as a human-readable breadcrumb in the Stripe dashboard.
    const provisionMetadata = {
      productId: docId,
      type: String(type),
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name, metadata: provisionMetadata },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: provisionMetadata,
      success_url: `${base}${sep}success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${sep}canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Could not create checkout session' }, { status: 500 })
  }
}
