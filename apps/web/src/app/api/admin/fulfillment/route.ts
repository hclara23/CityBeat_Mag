import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

// The fulfillment queue for the two paid products whose briefs used to land in
// WRITE-ONLY collections: Sponsored Story briefs go to `sponsored_stories` and
// Custom Quote briefs to `sales_fulfillment_briefs`, and until this route
// existed nothing in the app ever read either — a customer paid (up to
// $100,000 for a custom order), completed their brief, and no surface showed
// the work existed. This is the reader; the ops email on brief submission is
// the push signal.

const QUEUES = {
  sponsored_story: 'sponsored_stories',
  custom: 'sales_fulfillment_briefs',
} as const

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

async function requireSalesAccess() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  // The admin PAGES force 2FA enrollment (both route-group layouts); these
  // APIs approve paid content and must not accept a password-only session.
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

export async function GET() {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const [storiesSnap, customSnap] = await Promise.all([
      adminDb.collection(QUEUES.sponsored_story).orderBy('created_at', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      adminDb.collection(QUEUES.custom).orderBy('created_at', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    ])
    const shape = (kind: keyof typeof QUEUES) => (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data() as any
      return { id: d.id, kind, ...data, created_at: toIso(data.created_at) }
    }
    return NextResponse.json({
      briefs: [
        ...storiesSnap.docs.map(shape('sponsored_story')),
        ...customSnap.docs.map(shape('custom')),
      ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const kind = body.kind === 'custom' ? 'custom' : body.kind === 'sponsored_story' ? 'sponsored_story' : ''
  const action =
    body.action === 'in_progress' ? 'in_progress' : body.action === 'delivered' ? 'delivered' : ''
  if (!id || !kind || !action) {
    return NextResponse.json({ error: 'id, kind (sponsored_story|custom) and action (in_progress|delivered) required' }, { status: 400 })
  }
  const now = new Date().toISOString()
  try {
    const ref = adminDb.collection(QUEUES[kind]).doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    await ref.set(
      { status: action, handled_by: auth.user.id, handled_at: now, updated_at: now },
      { merge: true }
    )
    // Keep the rep's order tracker honest: their desk reads
    // sales_orders.fulfillment_status, which used to freeze at 'in_review'.
    const orderId = (existing.data() as any)?.sales_order_id
    if (orderId) {
      await adminDb.collection('sales_orders').doc(String(orderId)).set(
        { fulfillment_status: action === 'delivered' ? 'fulfilled' : 'in_progress', updated_at: now },
        { merge: true }
      ).catch(() => {})
    }
    return NextResponse.json({ success: true, status: action })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
