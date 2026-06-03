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
    return NextResponse.json({ error: 'Unauthorized. Please sign in to claim a business.' }, { status: 401 })
  }

  try {
    const { method, contactInfo } = await request.json()
    if (!method || !['email', 'phone', 'postcard'].includes(method)) {
      return NextResponse.json({ error: 'Invalid verification method' }, { status: 400 })
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const supabase = createServerClient(cookieStore)

    // Check if listing exists and is unclaimed
    const { data: listing, error: listingError } = await supabase
      .from('directory_listings')
      .select('name, claim_status')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.claim_status !== 'unclaimed') {
      return NextResponse.json({ error: 'Listing is already claimed or claim is pending' }, { status: 400 })
    }

    const status = method === 'postcard' ? 'pending' : 'code_sent'

    // Insert claim record
    const { error: claimError } = await supabase
      .from('directory_claims')
      .insert({
        listing_id: listingId,
        user_id: user.id,
        verification_method: method,
        verification_code: verificationCode,
        status,
        email_address: method === 'email' ? contactInfo : null,
        phone_number: method === 'phone' ? contactInfo : null,
      })

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 })
    }

    // Mock notification alerts
    if (method === 'email') {
      const emailBody = `Hello,\n\nYour 6-digit verification code to claim "${listing.name}" on CityBeat is: ${verificationCode}\n\nEnter this code on the claim dashboard to verify ownership.`
      await supabase.from('sent_notifications').insert({
        user_id: user.id,
        type: 'email',
        recipient: contactInfo,
        subject: `Verify ownership of ${listing.name}`,
        body: emailBody,
      })
      console.log(`[MOCK EMAIL] Verification code sent to ${contactInfo}: ${verificationCode}`)
    } else if (method === 'phone') {
      const smsBody = `CityBeat Code: ${verificationCode} for ${listing.name}. Enter this code to verify business ownership.`
      await supabase.from('sent_notifications').insert({
        user_id: user.id,
        type: 'sms',
        recipient: contactInfo,
        body: smsBody,
      })
      console.log(`[MOCK SMS] Verification code sent to ${contactInfo}: ${verificationCode}`)
    } else if (method === 'postcard') {
      console.log(`[POSTCARD REQUESTED] Verification code generated for postcard: ${verificationCode}`)
    }

    return NextResponse.json({ status, message: 'Verification request initiated' })
  } catch (error: any) {
    console.error('Error starting verification:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
