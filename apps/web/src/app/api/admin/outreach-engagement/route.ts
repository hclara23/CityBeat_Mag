import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { boardLeads } from '@/lib/lead-board'

export const dynamic = 'force-dynamic'

const COLLECTIONS = ['sales_outreach', 'upsell_outreach'] as const

async function authorize() {
  const user = await getServerUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  // This board returns business names + contact emails. Every other admin route
  // that exposes contact data requires 2FA; this one was the outlier.
  if (!profile?.mfa_enabled) {
    return { error: NextResponse.json({ error: 'Two-factor authentication required' }, { status: 403 }) }
  }
  return { user }
}

// Warm-leads board: which businesses a PERSON engaged with outreach, strongest
// evidence first (VERIFIED > HOT > WARM — lib/lead-heat.ts). Everything that is
// not a person, or not a usable lead, is left off and COUNTED so the board says
// why the list is short (lib/lead-board.ts). Sales/admin only.
export async function GET() {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  try {
    const snaps = await Promise.all(
      COLLECTIONS.map((c) => adminDb.collection(c).get().catch(() => ({ docs: [] as any[] })))
    )
    const docs = snaps.flatMap((snap, i) =>
      (snap.docs as any[]).map((d) => ({ id: d.id, collection: COLLECTIONS[i], ...d.data() }))
    )
    // email_suppressions is keyed by the normalised address (lib/suppression.ts),
    // so the ids ARE the list — no document bodies needed.
    const suppressionSnap = await adminDb.collection('email_suppressions').select().get().catch(() => ({ docs: [] as any[] }))
    const suppressed = new Set<string>((suppressionSnap.docs as any[]).map((d) => String(d.id).toLowerCase()))
    const { rows, summary } = boardLeads(docs, suppressed)
    return NextResponse.json({ rows: rows.slice(0, 100), summary })
  } catch {
    return NextResponse.json({ error: 'Could not load engagement' }, { status: 500 })
  }
}

// "Not real" / undo. Hides a lead from the board only — it does NOT unsubscribe
// or stop the email sequence (a rep's judgement that an inbox is not a person is
// not the recipient asking to be removed). Reversible with action 'restore'.
export async function POST(request: NextRequest) {
  const auth = await authorize()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => ({}))
  const collection = COLLECTIONS.find((c) => c === body?.collection)
  const id = typeof body?.id === 'string' ? body.id : ''
  const action = body?.action === 'restore' ? 'restore' : body?.action === 'dismiss' ? 'dismiss' : null
  if (!collection || !/^[A-Za-z0-9_:-]{1,120}$/.test(id) || !action) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const ref = adminDb.collection(collection).doc(id)
  const doc = await ref.get()
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await ref.set(
    action === 'dismiss'
      ? { lead_dismissed_at: new Date().toISOString(), lead_dismissed_by: auth.user.id }
      : { lead_dismissed_at: null, lead_dismissed_by: null },
    { merge: true }
  )
  return NextResponse.json({ ok: true })
}
