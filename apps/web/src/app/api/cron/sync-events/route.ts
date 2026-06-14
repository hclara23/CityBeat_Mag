import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMockEvents } from '@/lib/events-scraper'

export const dynamic = 'force-dynamic'

// Note: In production, you would want a cron secret or Vercel cron header validation
// to ensure only your cron job can trigger this endpoint.
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    // Use the service role key to bypass RLS for automated scripts
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. Fetch events from our scraper/API
    const events = await fetchMockEvents()

    // 2. Clear old events or upsert
    // For simplicity in this demo, we'll clear all events and insert the new ones.
    // In production, you would upsert based on an external ID.
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // delete all

    if (deleteError) {
      console.error('Error clearing old events:', deleteError)
      return NextResponse.json({ error: 'Failed to clear old events' }, { status: 500 })
    }

    const { error: insertError } = await supabase
      .from('events')
      .insert(events)

    if (insertError) {
      console.error('Error inserting events:', insertError)
      return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Synced ${events.length} events.` })
  } catch (error: any) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
