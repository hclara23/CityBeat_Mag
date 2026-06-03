import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // Route handlers do not need to write refreshed cookies for these reads.
    },
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id, cookieStore)
  if (!profile?.is_editor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServerClient(cookieStore)

  // Fetch pending approval listings
  const { data: claims, error } = await supabase
    .from('directory_listings')
    .select('*')
    .eq('claim_status', 'pending_approval')
    .order('claimed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ claims: claims || [] })
}
