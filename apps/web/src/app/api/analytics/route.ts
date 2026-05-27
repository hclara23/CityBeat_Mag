import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

type AnalyticsRow = {
  campaign_id: string
  event_type: string
  event_date: string
}

function getCookieStore() {
  const cookieStore = cookies()

  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // Route handlers do not need to write refreshed cookies for these reads.
    },
  }
}

function summarize(rows: AnalyticsRow[], campaignId: string | null, startDate: string | null, endDate: string | null) {
  const dailyData = new Map<string, { date: string; impressions: number; clicks: number; ctr: number }>()

  rows.forEach((row) => {
    const day = row.event_date
    const current = dailyData.get(day) ?? { date: day, impressions: 0, clicks: 0, ctr: 0 }

    if (row.event_type === 'impression') {
      current.impressions += 1
    }

    if (row.event_type === 'click') {
      current.clicks += 1
    }

    dailyData.set(day, current)
  })

  const daily = Array.from(dailyData.values())
    .map((day) => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalImpressions = daily.reduce((sum, day) => sum + day.impressions, 0)
  const totalClicks = daily.reduce((sum, day) => sum + day.clicks, 0)

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    const cookieStore = getCookieStore()
    const user = await getServerUser(cookieStore)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient(cookieStore)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('ad_campaigns')
      .select('id')
      .eq('created_by', user.id)

    if (campaignsError) throw campaignsError

    const campaignIds = (campaigns ?? []).map((campaign: { id: string }) => campaign.id)
    const selectedCampaignIds = campaignId ? [campaignId] : campaignIds

    if (!selectedCampaignIds.length || selectedCampaignIds.some((id) => !campaignIds.includes(id))) {
      return NextResponse.json(summarize([], campaignId, startDate, endDate))
    }

    let query = supabase
      .from('ad_events')
      .select('campaign_id, event_type, occurred_at')
      .in('campaign_id', selectedCampaignIds)

    if (startDate) query = query.gte('occurred_at', startDate)
    if (endDate) query = query.lte('occurred_at', `${endDate}T23:59:59.999Z`)

    const { data, error } = await query
    if (error) throw error

    const mappedData = (data ?? []).map((row: any) => ({
      campaign_id: row.campaign_id,
      event_type: row.event_type,
      event_date: row.occurred_at ? new Date(row.occurred_at).toISOString().split('T')[0] : '',
    }))

    return NextResponse.json(summarize(mappedData as AnalyticsRow[], campaignId, startDate, endDate))
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
