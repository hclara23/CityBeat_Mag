import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid user' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const {
    sponsor_id,
    placement_key,
    start_at,
    end_at,
    destination_url,
    creative_path,
  } = body

  if (
    !sponsor_id ||
    !placement_key ||
    !start_at ||
    !end_at ||
    !destination_url ||
    !creative_path
  ) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'advertiser'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: placement } = await supabase
    .from('ad_placements')
    .select('id, name')
    .eq('key', placement_key)
    .maybeSingle()

  if (!placement) {
    return new Response(JSON.stringify({ error: 'Invalid placement' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startDate = new Date(start_at)
  const endDate = new Date(end_at)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return new Response(JSON.stringify({ error: 'Invalid dates' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (endDate <= startDate) {
    return new Response(JSON.stringify({ error: 'End date must be after start date' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('ad_campaigns')
    .insert({
      sponsor_id,
      placement_id: placement.id,
      status: 'pending',
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single()

  if (campaignError || !campaign) {
    return new Response(JSON.stringify({ error: campaignError?.message ?? 'Campaign create failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: creativeError } = await supabase.from('ad_creatives').insert({
    campaign_id: campaign.id,
    asset_path: creative_path,
    destination_url,
    alt_text: placement.name,
  })

  if (creativeError) {
    return new Response(JSON.stringify({ error: creativeError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 1000,
          product_data: {
            name: `CityBeat Placement: ${placement.name}`,
          },
        },
      },
    ],
    success_url: `${origin}/portal/campaigns?status=success`,
    cancel_url: `${origin}/portal/campaigns/new?status=cancel`,
    metadata: {
      campaign_id: campaign.id,
    },
  })

  await supabase
    .from('ad_campaigns')
    .update({ stripe_session_id: session.id })
    .eq('id', campaign.id)

  return new Response(JSON.stringify({ session_id: session.id, url: session.url }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
