import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

// ad_campaigns (newsletter sponsorships) had NO admin surface at all before
// this — the self-serve dashboard filters by created_by, which a sales-rep-sold
// campaign never has, so a paid newsletter sponsorship could never be turned on
// by anyone in the product. Sales-desk-visible for the same reason jobs is: no
// ownership-dispute risk, a rep should be able to unblock their own sale.
async function requireSalesAccess() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const snap = await adminDb.collection('ad_campaigns').orderBy('created_at', 'desc').limit(300).get()
    const campaigns = snap.docs.map((d) => {
      const data = d.data() as any
      return { id: d.id, ...data, created_at: toIso(data.created_at) }
    })
    return NextResponse.json({ campaigns })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : ''
  if (!id || !action) return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })

  const now = new Date().toISOString()
  const updates =
    action === 'approve'
      ? { is_active: true, status: 'running', moderated_by: auth.user.id, moderated_at: now, updated_at: now }
      : { is_active: false, status: 'rejected', moderated_by: auth.user.id, moderated_at: now, updated_at: now }

  try {
    const ref = adminDb.collection('ad_campaigns').doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    await ref.set(updates, { merge: true })
    return NextResponse.json({ success: true, ...updates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
