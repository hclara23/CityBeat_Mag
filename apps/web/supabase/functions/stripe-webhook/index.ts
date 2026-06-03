import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response('Server misconfigured', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (_error) {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const campaignId = session.metadata?.campaign_id
  const listingId = session.metadata?.listing_id
  const ownerId = session.metadata?.owner_id
  const paymentIntentId = session.payment_intent?.toString()

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  if (listingId && ownerId) {
    const { error: updateError } = await supabase
      .from('directory_listings')
      .update({
        owner_id: ownerId,
        claim_status: 'pending_approval',
        stripe_subscription_id: session.subscription || null,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ received: true, listing_id: listingId, new_status: 'pending_approval' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!campaignId) {
    return new Response(JSON.stringify({ error: 'Missing campaign_id or listing_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error: updateError } = await supabase
    .from('ad_campaigns')
    .update({
      status: 'active',
      stripe_payment_intent_id: paymentIntentId ?? null,
    })
    .eq('id', campaignId)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true, campaign_id: campaignId, new_status: 'active' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
