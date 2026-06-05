import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id, cookieStore)
  if (!hasAdminAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action } = await request.json()
  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
  }

  const supabase = createServerClient(cookieStore)

  if (action === 'approve') {
    // Approve: set claim_status = 'approved', tier = 'premium'
    const { data: listing, error } = await supabase
      .from('directory_listings')
      .update({
        claim_status: 'approved',
        tier: 'premium',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, listing })
  } else {
    // Reject: reset claim_status = 'unclaimed', owner_id = null, stripe_subscription_id = null
    const { data: listing, error } = await supabase
      .from('directory_listings')
      .update({
        claim_status: 'unclaimed',
        owner_id: null,
        stripe_subscription_id: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, listing })
  }
}
