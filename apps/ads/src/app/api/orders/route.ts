import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, isAdvertiser, requiresAuth } from '@/lib/firebase'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

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

    const purchasesSnapshot = await adminDb
      .collection('ad_purchases')
      .where('advertiser_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get()

    const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const campaignIds = purchases
      .map((purchase: any) => purchase.campaign_id)
      .filter((id: string | null) => !!id)

    let campaignMap = new Map<string, string>()
    if (campaignIds.length > 0) {
      // Chunk campaign IDs into 10s to avoid Firestore limit
      const chunks = []
      for (let i = 0; i < campaignIds.length; i += 10) {
        chunks.push(campaignIds.slice(i, i + 10))
      }
      
      const campaigns: any[] = []
      for (const chunk of chunks) {
          const snapshot = await adminDb.collection('ad_campaigns').where('__name__', 'in', chunk).get()
          campaigns.push(...snapshot.docs.map(d => ({ id: d.id, name: d.data().name })))
      }

      campaignMap = new Map(campaigns.map((c: any) => [c.id, c.name]))
    }

    const orders: Order[] = purchases.map((purchase: any) => ({
      id: purchase.id,
      campaignName: purchase.campaign_id ? campaignMap.get(purchase.campaign_id) || 'Campaign' : 'Campaign',
      campaignId: purchase.campaign_id,
      adType: purchase.ad_type,
      amount: purchase.amount_total,
      billingCycle: purchase.billing_cycle || 'perpost',
      status: purchase.payment_status,
      createdAt: purchase.created_at?.toDate ? purchase.created_at.toDate().toISOString() : purchase.created_at,
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
