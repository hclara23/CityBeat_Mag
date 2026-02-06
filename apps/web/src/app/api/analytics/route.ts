import { NextRequest, NextResponse } from 'next/server'

// This endpoint will fetch analytics data from Supabase
// For now, returning mock data until Supabase is configured

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    // TODO: Connect to Supabase to fetch real analytics
    // const supabase = createClient({
    //   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    //   supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // })
    //
    // const { data, error } = await supabase
    //   .from('analytics')
    //   .select('*')
    //   .eq('campaign_id', campaignId)
    //   .gte('created_at', startDate)
    //   .lte('created_at', endDate)
    //
    // if (error) throw error

    // Mock data for development
    const analytics = {
      campaignId: campaignId || 'campaign-1',
      totalImpressions: 15234,
      totalClicks: 342,
      ctr: 2.24,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: endDate || new Date().toISOString(),
      dailyData: [
        {
          date: new Date().toISOString().split('T')[0],
          impressions: 500,
          clicks: 12,
          ctr: 2.4,
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          impressions: 480,
          clicks: 11,
          ctr: 2.29,
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          impressions: 520,
          clicks: 13,
          ctr: 2.5,
        },
      ],
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
