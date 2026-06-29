import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  if (v?._seconds) return new Date(v._seconds * 1000).toISOString()
  return typeof v === 'string' ? v : null
}
function monthKey(iso: string | null): string {
  return iso ? iso.slice(0, 7) : 'unknown'
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [paymentsSnap, purchasesSnap, transfersSnap, subsSnap] = await Promise.all([
      adminDb.collection('payments').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('ad_purchases').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('transfers').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('subscriptions').get().catch(() => ({ docs: [] as any[] })),
    ])

    // Incoming = invoice payments + ad purchases.
    const incoming = [
      ...(paymentsSnap.docs as any[]).map((d) => {
        const x = d.data()
        return { id: d.id, source: 'invoice', amount: x.amount || 0, currency: x.currency || 'usd', status: x.status, created_at: toIso(x.created_at), email: x.advertiser_email || null }
      }),
      ...(purchasesSnap.docs as any[]).map((d) => {
        const x = d.data()
        return { id: d.id, source: 'purchase', service: x.ad_type || 'advertisement', amount: x.amount_total || 0, currency: x.currency || 'usd', status: x.payment_status, created_at: toIso(x.created_at), email: x.advertiser_email || null }
      }),
    ].sort((a, b) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    // Outgoing = transfers we paid to users.
    const outgoing = (transfersSnap.docs as any[])
      .map((d) => {
        const x = d.data()
        return { id: d.id, payee_user_id: x.payee_user_id, service: x.service, amount: x.amount || 0, percent: x.percent, status: x.status, created_at: toIso(x.created_at) }
      })
      .sort((a, b) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    const totalIncoming = incoming.reduce((s, x) => s + (x.amount || 0), 0)
    const totalPaidOut = outgoing.filter((x) => x.status === 'paid').reduce((s, x) => s + (x.amount || 0), 0)

    // Monthly trend.
    const byMonth: Record<string, { month: string; incoming: number; outgoing: number }> = {}
    for (const x of incoming) {
      const k = monthKey(x.created_at)
      byMonth[k] = byMonth[k] || { month: k, incoming: 0, outgoing: 0 }
      byMonth[k].incoming += x.amount || 0
    }
    for (const x of outgoing) {
      if (x.status !== 'paid') continue
      const k = monthKey(x.created_at)
      byMonth[k] = byMonth[k] || { month: k, incoming: 0, outgoing: 0 }
      byMonth[k].outgoing += x.amount || 0
    }
    const monthly = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))

    // Payouts grouped by service.
    const byService: Record<string, number> = {}
    for (const x of outgoing) {
      if (x.status !== 'paid') continue
      byService[x.service] = (byService[x.service] || 0) + (x.amount || 0)
    }

    return NextResponse.json({
      summary: {
        total_incoming: totalIncoming,
        total_paid_out: totalPaidOut,
        platform_net: totalIncoming - totalPaidOut,
        active_subscriptions: (subsSnap.docs as any[]).filter((d) => (d.data() as any).status === 'active').length,
        currency: 'usd',
      },
      monthly,
      payouts_by_service: byService,
      incoming: incoming.slice(0, 100),
      outgoing: outgoing.slice(0, 100),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load finance data' }, { status: 500 })
  }
}
