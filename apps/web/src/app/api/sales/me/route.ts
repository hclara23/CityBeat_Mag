import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toMs(v: any): number {
  if (!v) return 0
  if (v?._seconds) return v._seconds * 1000
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

// A sales rep's own pipeline: closed deals, commission earned/pending, leaderboard.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [dealsSnap, transfersSnap] = await Promise.all([
      adminDb.collection('directory_listings').where('sold_by_rep', '==', user.id).get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('transfers').get().catch(() => ({ docs: [] as any[] })),
    ])

    // My closed directory deals.
    const deals = (dealsSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        return {
          id: d.id,
          name: x.name || 'Business',
          tier: x.tier || x.pending_tier || 'basic',
          claim_status: x.claim_status || 'pending_approval',
          contact_email: x.contact_email || null,
          claimed_at: toMs(x.claimed_at),
        }
      })
      .sort((a, b) => b.claimed_at - a.claimed_at)

    // Commission earned (paid transfers to me).
    const myTransfers = (transfersSnap.docs as any[])
      .map((d) => d.data())
      .filter((t) => t.payee_user_id === user.id && t.status === 'paid')
    const earned = myTransfers.reduce((s, t) => s + (t.amount || 0), 0)

    // Leaderboard: total paid commission by rep. Aggregate transfers, then fetch
    // ONLY the top-10 reps' profiles for names (instead of scanning all profiles).
    const byRep = new Map<string, number>()
    ;(transfersSnap.docs as any[]).forEach((d) => {
      const t = d.data()
      if (t.status !== 'paid' || !t.payee_user_id) return
      byRep.set(t.payee_user_id, (byRep.get(t.payee_user_id) || 0) + (t.amount || 0))
    })
    const top = [...byRep.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const nameById = new Map<string, string>()
    await Promise.all(
      top.map(async ([uid]) => {
        const doc = await adminDb.collection('profiles').doc(uid).get().catch(() => null)
        const p = doc && doc.exists ? (doc.data() as any) : null
        nameById.set(uid, p?.full_name || p?.email || uid.slice(0, 6))
      })
    )
    const leaderboard = top.map(([uid, amount]) => ({ name: nameById.get(uid) || uid.slice(0, 6), amount, me: uid === user.id }))

    return NextResponse.json({
      summary: {
        deals_closed: deals.length,
        commission_earned: earned,
        commission_count: myTransfers.length,
        currency: 'usd',
      },
      deals: deals.slice(0, 50),
      leaderboard,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load' }, { status: 500 })
  }
}
