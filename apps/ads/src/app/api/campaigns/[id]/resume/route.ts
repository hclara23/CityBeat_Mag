import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, isAdvertiser } from '@/lib/firebase'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { syncCampaignBanner } from '@/lib/banner-sync'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaignId = params.id

    const campaignRef = adminDb.collection('ad_campaigns').doc(campaignId)
    const campaignDoc = await campaignRef.get()
    
    if (!campaignDoc.exists) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    const data = campaignDoc.data()
    if (data?.advertiser_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await campaignRef.update({ status: 'active' })
    await syncCampaignBanner(campaignId, { active: true }).catch(() => {})

    return NextResponse.json({
      data: {
        id: campaignId,
        status: 'active',
        message: 'Campaign resumed successfully',
      },
    })
  } catch (error) {
    console.error('Error resuming campaign:', error)
    return NextResponse.json(
      { error: 'Failed to resume campaign' },
      { status: 500 }
    )
  }
}
