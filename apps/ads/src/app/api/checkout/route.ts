import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { FieldValue } from 'firebase-admin/firestore'

const stripeSecret = process.env.STRIPE_SECRET_KEY ?? ''
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-08-16',
})

export async function POST(req: NextRequest) {
  if (!stripeSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    sponsor_id,
    placement_key,
    start_at,
    end_at,
    destination_url,
    creative_path,
  } = body

  if (!sponsor_id || !placement_key || !start_at || !end_at || !destination_url || !creative_path) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const profile = await getServerUserProfile(user.id)
  if (!profile || !['admin', 'advertiser'].includes(profile.role)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const placementSnap = await adminDb.collection('ad_placements').where('key', '==', placement_key).limit(1).get()
  
  if (placementSnap.empty) {
    return NextResponse.json({ error: 'Invalid placement' }, { status: 400 })
  }
  const placement = { id: placementSnap.docs[0].id, ...placementSnap.docs[0].data() } as any

  const startDate = new Date(start_at)
  const endDate = new Date(end_at)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  }

  if (endDate <= startDate) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
  }

  // Create Campaign
  const campaignData = {
    sponsor_id,
    placement_id: placement.id,
    status: 'pending',
    start_at: startDate.toISOString(), // Firestore expects ISO string or Timestamp. We use ISO string for compat
    end_at: endDate.toISOString(),
    created_by: user.id,
    created_at: FieldValue.serverTimestamp()
  }

  let campaignRef
  try {
    campaignRef = await adminDb.collection('ad_campaigns').add(campaignData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Campaign create failed' }, { status: 400 })
  }

  try {
    await adminDb.collection('ad_creatives').add({
      campaign_id: campaignRef.id,
      asset_path: creative_path,
      destination_url,
      alt_text: placement.name,
      created_at: FieldValue.serverTimestamp()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 1000,
          product_data: {
            name: `CityBeat Placement: ${placement.name}`,
          },
        },
      },
    ],
    success_url: `${origin}/portal/campaigns?status=success`,
    cancel_url: `${origin}/portal/campaigns/new?status=cancel`,
    metadata: {
      campaign_id: campaignRef.id,
    },
  })

  await adminDb.collection('ad_campaigns').doc(campaignRef.id).update({
    stripe_session_id: session.id
  })

  return NextResponse.json({ session_id: session.id, url: session.url }, { status: 200 })
}
