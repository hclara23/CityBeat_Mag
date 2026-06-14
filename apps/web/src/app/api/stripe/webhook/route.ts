import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
})

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature') as string

  let event: Stripe.Event

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // In dev without webhook secret, just parse the JSON
      event = JSON.parse(body)
    }
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed.`, err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    
    // Expand line items to get metadata if it wasn't passed directly on the session
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const metadata = lineItems.data[0]?.price?.metadata || session.metadata

    if (metadata && metadata.productId && metadata.type) {
      try {
        if (metadata.type === 'job') {
          await adminDb.collection('jobs').doc(metadata.productId).update({
            is_active: true,
            status: 'published',
            payment_status: 'paid',
            published_at: new Date().toISOString()
          })
        } else if (metadata.type === 'ad_campaign') {
          await adminDb.collection('campaigns').doc(metadata.productId).update({
            is_active: true,
            status: 'running',
            payment_status: 'paid',
            published_at: new Date().toISOString()
          })
        }
        console.log(`Successfully provisioned ${metadata.type} ${metadata.productId}`)
      } catch (e: any) {
        console.error('Failed to update Firestore from webhook:', e)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
