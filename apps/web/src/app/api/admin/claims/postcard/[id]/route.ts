import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: claimId } = params
  if (!claimId) {
    return NextResponse.json({ error: 'Missing claim ID' }, { status: 400 })
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
  if (action !== 'mail') {
    return NextResponse.json({ error: 'Invalid action. Only "mail" is supported.' }, { status: 400 })
  }

  const supabase = createServerClient(cookieStore)

  // 1. Update claim status to code_sent
  const { data: claim, error: claimError } = await supabase
    .from('directory_claims')
    .update({ status: 'code_sent', updated_at: new Date().toISOString() })
    .eq('id', claimId)
    .select('*')
    .single()

  if (claimError || !claim) {
    return NextResponse.json({ error: claimError?.message || 'Claim not found' }, { status: 500 })
  }

  // 2. Fetch listing name
  const { data: listing } = await supabase
    .from('directory_listings')
    .select('name')
    .eq('id', claim.listing_id)
    .single()

  // 3. Log a mock notification for the mailed postcard
  const body = `Postcard mailed for "${listing?.name || 'your business'}". Code is: ${claim.verification_code}. Enter this code on the claim dashboard.`
  await supabase.from('sent_notifications').insert({
    user_id: claim.user_id,
    type: 'email',
    recipient: 'Business Address (Mailed)',
    subject: `Postcard mailed for ${listing?.name || 'your business'}`,
    body,
  })

  console.log(`[MOCK POSTCARD MAILED] Claim ID: ${claimId}, Code: ${claim.verification_code}`)

  return NextResponse.json({ success: true, claim })
}
