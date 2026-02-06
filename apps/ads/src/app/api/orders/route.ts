import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

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
    // TODO: Get user ID from session/JWT
    // const userId = await getUserIdFromRequest(request)
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // For now, return mock data
    // In production, query ad_purchases table:
    // const { data, error } = await supabase
    //   .from('ad_purchases')
    //   .select('*')
    //   .eq('advertiser_id', userId)
    //   .order('created_at', { ascending: false })

    const mockOrders: Order[] = [
      {
        id: 'order_1',
        campaignName: 'Summer Sale Newsletter',
        campaignId: 'camp_1',
        adType: 'newsletter',
        amount: 5000,
        billingCycle: 'monthly',
        status: 'active',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        nextBillingDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: 'https://invoices.example.com/order_1.pdf',
      },
      {
        id: 'order_2',
        campaignName: 'Tech Product Launch',
        campaignId: 'camp_2',
        adType: 'sponsored',
        amount: 10000,
        billingCycle: 'monthly',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        nextBillingDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: 'https://invoices.example.com/order_2.pdf',
      },
      {
        id: 'order_3',
        campaignName: 'Annual Banner Campaign',
        campaignId: 'camp_3',
        adType: 'banner',
        amount: 25000,
        billingCycle: 'yearly',
        status: 'completed',
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceUrl: 'https://invoices.example.com/order_3.pdf',
      },
    ]

    return NextResponse.json({ data: mockOrders })
  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
