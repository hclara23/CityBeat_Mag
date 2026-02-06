import { supabaseClient, supabaseServerClient } from './client'
import type {
  Campaign,
  CampaignAnalytics,
  DailyAnalytics,
  Profile,
  Subscription,
  Analytics,
  Payment,
} from './types'

// Profile queries
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data as Profile
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<Profile | null> {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data as Profile
  } catch (error) {
    console.error('Error updating user profile:', error)
    return null
  }
}

// Campaign queries
export async function getUserCampaigns(
  advertiserId: string
): Promise<Campaign[]> {
  try {
    const { data, error } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Campaign[]
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return []
  }
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  try {
    const { data, error } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (error) throw error
    return data as Campaign
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return null
  }
}

export async function createCampaign(
  campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
): Promise<Campaign | null> {
  try {
    const { data, error } = await supabaseServerClient
      .from('campaigns')
      .insert([campaign])
      .select()
      .single()

    if (error) throw error
    return data as Campaign
  } catch (error) {
    console.error('Error creating campaign:', error)
    return null
  }
}

export async function updateCampaign(
  campaignId: string,
  updates: Partial<Campaign>
): Promise<Campaign | null> {
  try {
    const { data, error } = await supabaseClient
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select()
      .single()

    if (error) throw error
    return data as Campaign
  } catch (error) {
    console.error('Error updating campaign:', error)
    return null
  }
}

// Analytics queries
export async function getCampaignAnalytics(
  campaignId: string,
  startDate?: string,
  endDate?: string
): Promise<CampaignAnalytics | null> {
  try {
    let impressionsQuery = supabaseClient
      .from('impressions')
      .select('count', { count: 'exact' })
      .eq('campaign_id', campaignId)

    let clicksQuery = supabaseClient
      .from('clicks')
      .select('count', { count: 'exact' })
      .eq('campaign_id', campaignId)

    let conversionsQuery = supabaseClient
      .from('conversions')
      .select('count', { count: 'exact' })
      .eq('campaign_id', campaignId)

    if (startDate) {
      impressionsQuery = impressionsQuery.gte('impression_date', startDate)
      clicksQuery = clicksQuery.gte('click_date', startDate)
      conversionsQuery = conversionsQuery.gte('conversion_date', startDate)
    }

    if (endDate) {
      impressionsQuery = impressionsQuery.lte('impression_date', endDate)
      clicksQuery = clicksQuery.lte('click_date', endDate)
      conversionsQuery = conversionsQuery.lte('conversion_date', endDate)
    }

    const [impressionsData, clicksData, conversionsData, campaignData] =
      await Promise.all([
        impressionsQuery,
        clicksQuery,
        conversionsQuery,
        supabaseClient
          .from('campaigns')
          .select('spent, budget')
          .eq('id', campaignId)
          .single(),
      ])

    const totalImpressions = impressionsData.data?.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0
    ) || 0
    const totalClicks = clicksData.data?.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0
    ) || 0
    const totalConversions = conversionsData.data?.reduce(
      (sum: number, row: any) => sum + (row.count || 0),
      0
    ) || 0
    const spent = (campaignData.data?.spent as number) || 0
    const budget = (campaignData.data?.budget as number) || 0

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const conversionRate =
      totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    const roi = spent > 0 ? ((budget - spent) / spent) * 100 : 0

    return {
      campaign_id: campaignId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      ctr,
      conversion_rate: conversionRate,
      total_spent: spent,
      roi,
    }
  } catch (error) {
    console.error('Error fetching campaign analytics:', error)
    return null
  }
}

export async function getDailyAnalytics(
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<DailyAnalytics[]> {
  try {
    const [impressionsData, clicksData, conversionsData] = await Promise.all([
      supabaseClient
        .from('impressions')
        .select('impression_date, count')
        .eq('campaign_id', campaignId)
        .gte('impression_date', startDate)
        .lte('impression_date', endDate)
        .order('impression_date', { ascending: true }),
      supabaseClient
        .from('clicks')
        .select('click_date, count')
        .eq('campaign_id', campaignId)
        .gte('click_date', startDate)
        .lte('click_date', endDate)
        .order('click_date', { ascending: true }),
      supabaseClient
        .from('conversions')
        .select('conversion_date, count')
        .eq('campaign_id', campaignId)
        .gte('conversion_date', startDate)
        .lte('conversion_date', endDate)
        .order('conversion_date', { ascending: true }),
    ])

    // Merge data by date
    const dailyData: Record<string, DailyAnalytics> = {}

    impressionsData.data?.forEach((row: any) => {
      if (!dailyData[row.impression_date]) {
        dailyData[row.impression_date] = {
          date: row.impression_date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          spent: 0,
        }
      }
      dailyData[row.impression_date].impressions = row.count
    })

    clicksData.data?.forEach((row: any) => {
      if (!dailyData[row.click_date]) {
        dailyData[row.click_date] = {
          date: row.click_date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          spent: 0,
        }
      }
      dailyData[row.click_date].clicks = row.count
    })

    conversionsData.data?.forEach((row: any) => {
      if (!dailyData[row.conversion_date]) {
        dailyData[row.conversion_date] = {
          date: row.conversion_date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          spent: 0,
        }
      }
      dailyData[row.conversion_date].conversions = row.count
    })

    // Calculate CTR for each day
    return Object.values(dailyData).map((day) => ({
      ...day,
      ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
    }))
  } catch (error) {
    console.error('Error fetching daily analytics:', error)
    return []
  }
}

// Subscription queries
export async function getUserSubscription(
  advertiserId: string
): Promise<Subscription | null> {
  try {
    const { data, error } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return (data as Subscription) || null
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

// Payment queries
export async function getPaymentHistory(
  advertiserId: string,
  limit: number = 10,
  offset: number = 0
): Promise<Payment[]> {
  try {
    const { data, error } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return (data as Payment[]) || []
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return []
  }
}
