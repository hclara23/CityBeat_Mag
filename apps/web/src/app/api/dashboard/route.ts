import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id)

  let campaigns: any[] = []
  try {
    const snap = await adminDb.collection('ad_campaigns').where('created_by', '==', user.id).get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))

    const [placementsSnap, sponsorsSnap] = await Promise.all([
      adminDb.collection('ad_placements').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('sponsors').get().catch(() => ({ docs: [] as any[] })),
    ])
    const placementMap = new Map((placementsSnap.docs as any[]).map((d) => [d.id, (d.data() as any).name]))
    const sponsorMap = new Map((sponsorsSnap.docs as any[]).map((d) => [d.id, (d.data() as any).name]))

    let events: any[] = []
    if (rows.length > 0) {
      const evSnap = await adminDb
        .collection('ad_events')
        .where('campaign_id', 'in', rows.slice(0, 10).map((r) => r.id))
        .get()
        .catch(() => ({ docs: [] as any[] }))
      events = (evSnap.docs as any[]).map((d) => d.data())
    }

    campaigns = rows.map((row: any) => {
      const ce = events.filter((e) => e.campaign_id === row.id)
      const impressions = ce.filter((e) => e.event_type === 'impression').length
      const clicks = ce.filter((e) => e.event_type === 'click').length
      return {
        id: row.id,
        name: `${sponsorMap.get(row.sponsor_id) || 'Sponsor'} - ${placementMap.get(row.placement_id) || 'Placement'}`,
        status: row.status,
        created_at: toIso(row.created_at),
        impressions,
        clicks,
      }
    })
  } catch (error) {
    console.error('dashboard error:', error)
  }

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)

  return NextResponse.json({
    profile,
    campaigns,
    stats: {
      totalImpressions,
      totalClicks,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    },
  })
}
