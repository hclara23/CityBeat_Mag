import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserIdFromRequest, isAdvertiser, requiresAuth } from '@/lib/supabase'

interface Order {
  id: string
  campaignName: string
  campaignId: string
  adType: string
  amount: number
  billingCycle: string
  status: string
  createdAt: string
  nextBillingDate?: string
  invoiceUrl?: string
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      if (requiresAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ data: [] })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data: purchases, error } = await supabase
      .from('ad_purchases')
      .select('id,campaign_id,ad_type,billing_cycle,amount_total,payment_status,created_at')
      .eq('advertiser_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const campaignIds = (purchases ?? [])
      .map((purchase: any) => purchase.campaign_id)
      .filter((id: string | null) => !!id)

    let campaignMap = new Map<string, string>()
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id,name')
        .in('id', campaignIds)

      campaignMap = new Map((campaigns ?? []).map((c: any) => [c.id, c.name]))
    }

    const orders: Order[] = (purchases ?? []).map((purchase: any) => ({
      id: purchase.id,
      campaignName: purchase.campaign_id ? campaignMap.get(purchase.campaign_id) || 'Campaign' : 'Campaign',
      campaignId: purchase.campaign_id,
      adType: purchase.ad_type,
      amount: purchase.amount_total,
      billingCycle: purchase.billing_cycle || 'perpost',
      status: purchase.payment_status,
      createdAt: purchase.created_at,
    }))

    return NextResponse.json({ data: orders })
  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
