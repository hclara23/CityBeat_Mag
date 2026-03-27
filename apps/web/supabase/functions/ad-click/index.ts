import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const isSafeUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

serve(async (req) => {
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Server misconfigured', { status: 500 })
  }

  const url = new URL(req.url)
  const campaignId = url.searchParams.get('campaign_id')
  const placementKey = url.searchParams.get('placement_key')

  if (!campaignId || !placementKey) {
    return new Response(JSON.stringify({ error: 'Missing campaign_id or placement_key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date().toISOString()

  const { data: placement } = await supabase
    .from('ad_placements')
    .select('id')
    .eq('key', placementKey)
    .maybeSingle()

  if (!placement) {
    return new Response(JSON.stringify({ error: 'Placement not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: campaign } = await supabase
    .from('ad_campaigns')
    .select('id, status, start_at, end_at')
    .eq('id', campaignId)
    .eq('status', 'active')
    .lte('start_at', now)
    .gte('end_at', now)
    .maybeSingle()

  if (!campaign) {
    return new Response(JSON.stringify({ error: 'Campaign not active' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: creative } = await supabase
    .from('ad_creatives')
    .select('destination_url')
    .eq('campaign_id', campaignId)
    .limit(1)
    .maybeSingle()

  if (!creative?.destination_url || !isSafeUrl(creative.destination_url)) {
    return new Response(JSON.stringify({ error: 'Creative not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('ad_events').insert({
    campaign_id: campaignId,
    placement_id: placement.id,
    event_type: 'click',
    meta: {
      user_agent: req.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.redirect(creative.destination_url, 302)
})
