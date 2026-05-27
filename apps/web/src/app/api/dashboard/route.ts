import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CampaignRow = {
  id: string
  status: string
  created_at: string
  placement?: any
  sponsor?: any
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

export async function GET() {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(cookieStore)
  const profile = await getServerUserProfile(user.id, cookieStore)

  const { data, error } = await supabase
    .from('ad_campaigns')
    .select(`
      id,
      status,
      created_at,
      placement:ad_placements(name, key),
      sponsor:sponsors(name)
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load dashboard campaigns' },
      { status: 500 }
    )
  }

  let events: { campaign_id: string; event_type: string }[] = []
  if (data && data.length > 0) {
    const campaignIds = data.map((c) => c.id)
    const { data: eventsData, error: eventsError } = await supabase
      .from('ad_events')
      .select('campaign_id, event_type')
      .in('campaign_id', campaignIds)
    if (!eventsError && eventsData) {
      events = eventsData
    }
  }

  const campaigns = (data ?? []).map((row: any) => {
    const campaignEvents = events.filter((e) => e.campaign_id === row.id)
    const impressions = campaignEvents.filter((e) => e.event_type === 'impression').length
    const clicks = campaignEvents.filter((e) => e.event_type === 'click').length

    const placementName = row.placement?.[0]?.name || row.placement?.name || 'Placement'
    const sponsorName = row.sponsor?.[0]?.name || row.sponsor?.name || 'Sponsor'
    const campaignName = `${sponsorName} - ${placementName}`

    return {
      id: row.id,
      name: campaignName,
      status: row.status,
      created_at: row.created_at,
      impressions,
      clicks,
    }
  })

  const totalImpressions = campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0)
  const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)

  return NextResponse.json({
    profile,
    campaigns,
    stats: {
      totalImpressions,
      totalClicks,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    },
  })
}
