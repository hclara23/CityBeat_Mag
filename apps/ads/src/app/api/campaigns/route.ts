import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserIdFromRequest, isAdvertiser, requiresAuth } from '@/lib/supabase'
import { getPrice, type AdType, type BillingCycle } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

function mapCampaign(row: any) {
  return {
    id: row.id,
    name: row.name,
    adType: row.ad_type,
    billingCycle: row.billing_cycle,
    status: row.status,
    amount: row.amount_cents,
    createdAt: row.created_at,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      if (requiresAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ data: [], count: 0 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('advertiser_id', userId)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    const campaigns = (data ?? []).map(mapCampaign)

    return NextResponse.json({
      data: campaigns,
      count: campaigns.length,
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, adType, billingCycle, description, startDate, endDate } = body

    // Validate request
    if (!name || !adType || !billingCycle) {
      return NextResponse.json(
        { error: 'Missing required fields: name, adType, billingCycle' },
        { status: 400 }
      )
    }

    let amount: number
    try {
      amount = getPrice(adType as AdType, billingCycle as BillingCycle)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid pricing selection' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert([
        {
          advertiser_id: userId,
          name,
          description: description || null,
          ad_type: adType,
          billing_cycle: billingCycle,
          amount_cents: amount,
          status: 'pending',
          impressions: 0,
          clicks: 0,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      ])
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ data: mapCampaign(campaign) }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
