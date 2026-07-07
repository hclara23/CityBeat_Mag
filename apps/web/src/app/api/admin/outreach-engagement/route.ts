import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}
function ms(v: any): number {
  if (!v) return 0
  if (v?.toDate) return v.toDate().getTime()
  return Date.parse(v) || 0
}

// Warm-leads board: which businesses engaged with outreach. A business that
// opened or (better) clicked is a hot prospect a rep should call TODAY. Ranks
// clicked > opened > sent, newest engagement first. Sales/admin only.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Pull every marketing stream that tracks engagement.
    const [salesSnap, upsellSnap] = await Promise.all([
      adminDb.collection('sales_outreach').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('upsell_outreach').get().catch(() => ({ docs: [] as any[] })),
    ])

    const rows = [...(salesSnap.docs as any[]), ...(upsellSnap.docs as any[])]
      .map((d) => {
        const x = d.data()
        const opens = Number(x.opens) || 0
        const clicks = Number(x.clicks) || 0
        return {
          id: d.id,
          listing_id: x.listing_id || null,
          business: x.business_name || x.email || 'Business',
          email: x.email || null,
          opens,
          clicks,
          status: x.status || 'sent',
          last_activity: toIso(x.last_click_at) || toIso(x.last_open_at) || toIso(x.last_sent_at),
          _sort: (clicks > 0 ? 2_000_000 : opens > 0 ? 1_000_000 : 0) + Math.max(ms(x.last_click_at), ms(x.last_open_at)),
          heat: clicks > 0 ? 'hot' : opens > 0 ? 'warm' : 'cold',
        }
      })
      // Only surface people who actually engaged — that's the whole point.
      .filter((r) => r.opens > 0 || r.clicks > 0)
      .sort((a, b) => b._sort - a._sort)
      .slice(0, 100)
      .map(({ _sort, ...r }) => r)

    const summary = {
      engaged: rows.length,
      hot: rows.filter((r) => r.heat === 'hot').length,
      warm: rows.filter((r) => r.heat === 'warm').length,
    }
    return NextResponse.json({ rows, summary })
  } catch {
    return NextResponse.json({ error: 'Could not load engagement' }, { status: 500 })
  }
}
