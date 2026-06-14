import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

const isSafeUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('campaign_id')
  const placementKey = url.searchParams.get('placement_key')

  if (!campaignId || !placementKey) {
    return NextResponse.json({ error: 'Missing campaign_id or placement_key' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const placementSnap = await adminDb.collection('ad_placements').where('key', '==', placementKey).limit(1).get()

  if (placementSnap.empty) {
    return NextResponse.json({ error: 'Placement not found' }, { status: 404 })
  }
  const placementId = placementSnap.docs[0].id

  const campaignSnap = await adminDb.collection('ad_campaigns').doc(campaignId).get()

  if (!campaignSnap.exists) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const campaign = campaignSnap.data() as any

  if (campaign.status !== 'active' || campaign.start_at > now || campaign.end_at < now) {
    return NextResponse.json({ error: 'Campaign not active' }, { status: 404 })
  }

  const creativeSnap = await adminDb.collection('ad_creatives').where('campaign_id', '==', campaignId).limit(1).get()

  if (creativeSnap.empty) {
    return NextResponse.json({ error: 'Creative not found' }, { status: 404 })
  }

  const creative = creativeSnap.docs[0].data() as any

  if (!creative.destination_url || !isSafeUrl(creative.destination_url)) {
    return NextResponse.json({ error: 'Creative destination invalid' }, { status: 404 })
  }

  try {
    await adminDb.collection('ad_events').add({
      campaign_id: campaignId,
      placement_id: placementId,
      event_type: 'click',
      meta: {
        user_agent: req.headers.get('user-agent') ?? 'unknown',
      },
      created_at: FieldValue.serverTimestamp()
    })
  } catch (error) {
    console.error('Failed to log click event:', error)
  }

  return NextResponse.redirect(creative.destination_url, { status: 302 })
}
