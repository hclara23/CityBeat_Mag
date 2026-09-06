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
  // Social Media Promotion briefs land in a write-only collection too — same
  // "customer paid, nothing shows it" trap, so it belongs in this same queue.
  social_promotion: 'social_promotions',
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
    const [storiesSnap, customSnap, socialSnap] = await Promise.all([
      adminDb.collection(QUEUES.sponsored_story).orderBy('created_at', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      adminDb.collection(QUEUES.custom).orderBy('created_at', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
      adminDb.collection(QUEUES.social_promotion).orderBy('created_at', 'desc').limit(200).get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] })),
    ])
    const shape = (kind: keyof typeof QUEUES) => (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data() as any
      return { id: d.id, kind, ...data, created_at: toIso(data.created_at) }
    }
    // Paid, but no brief yet. The three queues above only ever contained
    // SUBMITTED briefs, so an order where the customer paid and then never came
    // back to describe what they wanted appeared on no operator surface at all —
    // money taken, a product owed, and nothing showing the obligation. It could
    // sit that way forever. A rep sees their own count on the Sales Desk; nobody
    // saw it across the business.
    //
    // Single equality filter (automatic index), paid check in memory: this is a
    // short list by nature, and a composite index that has to exist before the
    // query works is a worse failure mode on a page an operator relies on.
    const awaitingSnap = await adminDb
      .collection('sales_orders')
      .where('fulfillment_status', '==', 'awaiting_intake')
      .limit(200)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))

    const nowMs = Date.now()
    const awaitingIntake = awaitingSnap.docs
      .map((d) => {
        const data = d.data() as any
        const paidAt = toIso(data.paid_at) || toIso(data.created_at)
        const paidMs = paidAt ? Date.parse(paidAt) : NaN
        return {
          id: d.id,
          business_name: data.business_name || null,
          contact_email: data.contact_email || null,
          product_id: data.product_id || null,
          product_name: data.product_name || data.product_id || null,
          amount_paid: Number(data.amount_paid ?? data.amount ?? 0),
          currency: data.currency || 'usd',
          intake_status: data.intake_status || 'not_started',
          intake_completion: Number(data.intake_completion) || 0,
          sold_by: data.sold_by || null,
          locale: data.locale === 'es' ? 'es' : 'en',
          paid_at: paidAt,
          // How long we have owed them, which is the number that decides who to
          // chase first.
          days_waiting: Number.isFinite(paidMs) ? Math.floor((nowMs - paidMs) / 86400000) : null,
        }
      })
      .filter((row) => row.amount_paid > 0 || row.paid_at)
      .sort((a, b) => (b.days_waiting ?? -1) - (a.days_waiting ?? -1))

    return NextResponse.json({
      briefs: [
        ...storiesSnap.docs.map(shape('sponsored_story')),
        ...customSnap.docs.map(shape('custom')),
        ...socialSnap.docs.map(shape('social_promotion')),
      ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
      awaiting_intake: awaitingIntake,
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
  const kind: keyof typeof QUEUES | '' =
    body.kind === 'custom' || body.kind === 'sponsored_story' || body.kind === 'social_promotion' ? body.kind : ''
  const action =
    body.action === 'in_progress' ? 'in_progress' : body.action === 'delivered' ? 'delivered' : ''
  if (!id || !kind || !action) {
    return NextResponse.json({ error: 'id, kind (sponsored_story|custom|social_promotion) and action (in_progress|delivered) required' }, { status: 400 })
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
