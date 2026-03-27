import { NextRequest, NextResponse } from 'next/server'
import { stripe, validateStripeKey } from '@/src/lib/stripe'
import { createClient } from '@/src/lib/supabase/server'

// Webhook secret from environment
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  validateStripeKey()
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: 'Missing signature or webhook secret' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any

      const campaignId = session.metadata?.campaignId
      const userId = session.metadata?.userId

      if (!campaignId) {
        console.error('Webhook missing campaignId in metadata')
        return NextResponse.json(
          { error: 'Missing campaign ID' },
          { status: 400 }
        )
      }

      // Update campaign status to 'active'
      const supabase = await createClient()
      const { error: updateError } = await supabase
        .from('ad_campaigns')
        .update({
          status: 'active',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent,
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Error updating campaign:', updateError)
        return NextResponse.json(
          { error: 'Failed to update campaign' },
          { status: 500 }
        )
      }

      console.log(`Campaign ${campaignId} activated via webhook`)
    }

    // Handle payment_intent.payment_failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any

      // Find and update campaign if tracked
      const campaignId = paymentIntent.metadata?.campaignId

      if (campaignId) {
        const supabase = await createClient()
        await supabase
          .from('ad_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaignId)

        console.log(`Campaign ${campaignId} marked as failed due to payment failure`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
