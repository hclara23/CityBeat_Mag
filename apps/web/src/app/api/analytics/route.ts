import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

type AnalyticsRow = { campaign_id: string; event_type: string; event_date: string }

function summarize(rows: AnalyticsRow[], campaignId: string | null, startDate: string | null, endDate: string | null) {
  const dailyData = new Map<string, { date: string; impressions: number; clicks: number; ctr: number }>()
  rows.forEach((row) => {
    const current = dailyData.get(row.event_date) ?? { date: row.event_date, impressions: 0, clicks: 0, ctr: 0 }
    if (row.event_type === 'impression') current.impressions += 1
    if (row.event_type === 'click') current.clicks += 1
    dailyData.set(row.event_date, current)
  })
  const daily = Array.from(dailyData.values())
    .map((day) => ({ ...day, ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0)
  const totalClicks = daily.reduce((s, d) => s + d.clicks, 0)
  return {
    campaignId: campaignId || 'all',
    totalImpressions,
    totalClicks,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    startDate: startDate || daily[0]?.date || null,
    endDate: endDate || daily[daily.length - 1]?.date || null,
    dailyData: daily,
  }
}

function toDay(v: any): string {
  if (v?.toDate) return v.toDate().toISOString().split('T')[0]
  if (typeof v === 'string') return new Date(v).toISOString().split('T')[0]
  return ''
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campSnap = await adminDb.collection('ad_campaigns').where('created_by', '==', user.id).get()
    const campaignIds = campSnap.docs.map((d) => d.id)
    const selected = campaignId ? [campaignId] : campaignIds

    if (!selected.length || selected.some((id) => !campaignIds.includes(id))) {
      return NextResponse.json(summarize([], campaignId, startDate, endDate))
    }

    const evSnap = await adminDb
      .collection('ad_events')
      .where('campaign_id', 'in', selected.slice(0, 10))
      .get()
      .catch(() => ({ docs: [] as any[] }))

    let rows = (evSnap.docs as any[]).map((d) => {
      const r = d.data()
      return { campaign_id: r.campaign_id, event_type: r.event_type, event_date: toDay(r.occurred_at) }
    })
    if (startDate) rows = rows.filter((r) => r.event_date >= startDate)
    if (endDate) rows = rows.filter((r) => r.event_date <= endDate)

    return NextResponse.json(summarize(rows as AnalyticsRow[], campaignId, startDate, endDate))
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
