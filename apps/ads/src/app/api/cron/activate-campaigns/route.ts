import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Never prerender at build time — this hits Firestore on each request, which
// hangs (and times out the whole build) when run during static generation.
export const dynamic = 'force-dynamic'

// This endpoint should be protected by a cron secret or similar in production
export async function GET() {
  const now = new Date().toISOString()
  const activated: any[] = []
  const expired: any[] = []

  try {
    const campaignsRef = adminDb.collection('ad_campaigns')

    // Find campaigns to activate
    const pendingSnap = await campaignsRef
      .where('status', '==', 'pending')
      .get()

    // Find campaigns to expire
    const activeSnap = await campaignsRef
      .where('status', '==', 'active')
      .get()

    const batch = adminDb.batch()

    pendingSnap.docs.forEach(doc => {
      const data = doc.data()
      if (data.stripe_payment_intent_id && data.start_at <= now && data.end_at >= now) {
        batch.update(doc.ref, { status: 'active', updated_at: FieldValue.serverTimestamp() })
        activated.push({ id: doc.id, placement_id: data.placement_id, start_at: data.start_at })
      }
    })

    activeSnap.docs.forEach(doc => {
      const data = doc.data()
      if (data.end_at < now) {
        batch.update(doc.ref, { status: 'ended', updated_at: FieldValue.serverTimestamp() })
        expired.push({ id: doc.id, placement_id: data.placement_id, end_at: data.end_at })
      }
    })

    await batch.commit()

    return NextResponse.json({
      activated_count: activated.length,
      expired_count: expired.length,
      activated,
      expired,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error activating/expiring campaigns:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
