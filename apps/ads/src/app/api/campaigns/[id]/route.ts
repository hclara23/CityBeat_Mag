import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest, isAdvertiser, requiresAuth } from '@/lib/firebase'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function mapCampaign(row: any) {
  return {
    id: row.id,
    name: row.name,
    campaignName: row.name,
    adType: row.ad_type,
    billingCycle: row.billing_cycle,
    status: row.status,
    amount: row.amount_cents,
    createdAt: row.created_at?.toDate ? row.created_at.toDate().toISOString() : row.created_at,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      if (requiresAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaignId = params.id

    const docRef = adminDb.collection('ad_campaigns').doc(campaignId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign: any = { id: docSnap.id, ...docSnap.data() }

    if (campaign.advertiser_id !== userId) {
       return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ data: mapCampaign(campaign) })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const body = await request.json()

    const docRef = adminDb.collection('ad_campaigns').doc(campaignId)
    const docSnap = await docRef.get()

    if (!docSnap.exists || docSnap.data()?.advertiser_id !== userId) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const allowedUpdates: Record<string, any> = {}

    if (body.name) allowedUpdates.name = body.name
    if (body.description !== undefined) allowedUpdates.description = body.description
    if (body.status) allowedUpdates.status = body.status
    if (body.startDate !== undefined) allowedUpdates.start_date = body.startDate
    if (body.endDate !== undefined) allowedUpdates.end_date = body.endDate

    await docRef.update(allowedUpdates)

    const updatedSnap = await docRef.get()
    const campaign = { id: updatedSnap.id, ...updatedSnap.data() }

    return NextResponse.json({ data: mapCampaign(campaign) })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const docRef = adminDb.collection('ad_campaigns').doc(campaignId)
    const docSnap = await docRef.get()

    if (!docSnap.exists || docSnap.data()?.advertiser_id !== userId) {
       return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    await docRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}
