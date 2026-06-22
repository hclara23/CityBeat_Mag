import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id: claimId } = params
  if (!claimId) return NextResponse.json({ error: 'Missing claim ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json()
  if (action !== 'mail') {
    return NextResponse.json({ error: 'Invalid action. Only "mail" is supported.' }, { status: 400 })
  }

  try {
    const ref = adminDb.collection('directory_claims').doc(claimId)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    await ref.set({ status: 'code_sent', updated_at: new Date().toISOString() }, { merge: true })
    const claim = (await ref.get()).data() as any

    let listingName = 'your business'
    if (claim.listing_id) {
      const lDoc = await adminDb.collection('directory_listings').doc(claim.listing_id).get()
      if (lDoc.exists) listingName = (lDoc.data() as any).name || listingName
    }

    await adminDb.collection('sent_notifications').add({
      user_id: claim.user_id,
      type: 'email',
      recipient: 'Business Address (Mailed)',
      subject: `Postcard mailed for ${listingName}`,
      body: `Postcard mailed for "${listingName}". Code is: ${claim.verification_code}. Enter this code on the claim dashboard.`,
      created_at: FieldValue.serverTimestamp(),
    })

    console.log(`[MOCK POSTCARD MAILED] Claim ID: ${claimId}, Code: ${claim.verification_code}`)

    return NextResponse.json({ success: true, claim: { id: claimId, ...claim } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
