import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async () => {
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date().toISOString()

  const { data: activated } = await supabase
    .from('ad_campaigns')
    .update({ status: 'active' })
    .eq('status', 'pending')
    .not('stripe_payment_intent_id', 'is', null)
    .lte('start_at', now)
    .gte('end_at', now)
    .select('id, placement_id, start_at')

  const { data: expired } = await supabase
    .from('ad_campaigns')
    .update({ status: 'ended' })
    .eq('status', 'active')
    .lt('end_at', now)
    .select('id, placement_id, end_at')

  return new Response(
    JSON.stringify({
      activated_count: activated?.length ?? 0,
      expired_count: expired?.length ?? 0,
      activated: activated ?? [],
      expired: expired ?? [],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
