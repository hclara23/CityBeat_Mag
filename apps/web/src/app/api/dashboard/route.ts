import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CampaignRow = {
  id: string
  name: string
  status: string
  created_at: string
  impressions?: number | null
  clicks?: number | null
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

function mapCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
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
    .from('campaigns')
    .select('*')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load dashboard campaigns' },
      { status: 500 }
    )
  }

  const campaigns = (data ?? []).map(mapCampaign)
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
