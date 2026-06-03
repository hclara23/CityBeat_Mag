import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'

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
  const { id: listingId } = params
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in to verify your claim.' }, { status: 401 })
  }

  try {
    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Missing verification code' }, { status: 400 })
    }

    const supabase = createServerClient(cookieStore)

    // Find the latest pending or code_sent claim for this user/listing
    const { data: claim, error: claimError } = await supabase
      .from('directory_claims')
      .select('*')
      .eq('listing_id', listingId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'code_sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (claimError || !claim) {
      return NextResponse.json({ error: 'No active claim request found for this listing' }, { status: 404 })
    }

    if (claim.verification_code !== code.trim()) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 })
    }

    // Update claim status to verified
    const { error: updateClaimError } = await supabase
      .from('directory_claims')
      .update({ status: 'verified', updated_at: new Date().toISOString() })
      .eq('id', claim.id)

    if (updateClaimError) {
      return NextResponse.json({ error: updateClaimError.message }, { status: 500 })
    }

    // Update listing to be claimed by the user and approved (free claim is approved immediately upon code verification)
    const { error: updateListingError } = await supabase
      .from('directory_listings')
      .update({
        owner_id: user.id,
        claim_status: 'approved',
        tier: 'basic', // explicitly remains basic until premium upgrade payment is completed
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    if (updateListingError) {
      return NextResponse.json({ error: updateListingError.message }, { status: 500 })
    }

    // Also update the user's role profile to is_advertiser = true so they are marked as a business owner
    await supabase
      .from('profiles')
      .update({ is_advertiser: true })
      .eq('id', user.id)

    return NextResponse.json({ success: true, message: 'Business ownership verified successfully!' })
  } catch (error: any) {
    console.error('Error verifying claim code:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
