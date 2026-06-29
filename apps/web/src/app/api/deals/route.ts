import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

function toMs(v: any): number {
  if (!v) return 0
  if (v?._seconds) return v._seconds * 1000
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

// GET: public active deals. ?mine=1 (auth): the caller's own deals.
export async function GET(request: NextRequest) {
  const mine = new URL(request.url).searchParams.get('mine') === '1'

  if (mine) {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const snap = await adminDb.collection('deals').where('owner_id', '==', user.id).get().catch(() => ({ docs: [] as any[] }))
    const deals = (snap.docs as any[]).map((d) => ({ id: d.id, ...d.data(), created_at: toMs(d.data().created_at) }))
    return NextResponse.json({ deals: deals.sort((a, b) => b.created_at - a.created_at) })
  }

  const snap = await adminDb.collection('deals').where('status', '==', 'active').get().catch(() => ({ docs: [] as any[] }))
  const now = Date.now()
  const deals = (snap.docs as any[])
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((d) => !d.expires_at || Date.parse(d.expires_at) >= now)
    .sort((a, b) => toMs(b.created_at) - toMs(a.created_at))
    .slice(0, 100)
  return NextResponse.json({ deals })
}

// POST: a directory owner on Premium/Featured posts a deal for their listing.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const listingId = typeof body.listingId === 'string' ? body.listingId : ''
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : ''
  const code = typeof body.code === 'string' ? body.code.trim().slice(0, 40) : ''
  const expires_at = typeof body.expires_at === 'string' && !Number.isNaN(Date.parse(body.expires_at)) ? new Date(body.expires_at).toISOString() : null

  if (!listingId || !title) return NextResponse.json({ error: 'Listing and title are required.' }, { status: 400 })

  // Must own the listing and be on a paid tier (deals are a Premium+ perk).
  const lDoc = await adminDb.collection('directory_listings').doc(listingId).get()
  if (!lDoc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const l = lDoc.data() as any
  if (l.owner_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
  if (l.tier !== 'premium' && l.tier !== 'featured') {
    return NextResponse.json({ error: 'Deals are a Premium feature. Upgrade your listing to post deals.' }, { status: 402 })
  }

  const ref = await adminDb.collection('deals').add({
    listing_id: listingId,
    owner_id: user.id,
    business_name: l.name || null,
    title,
    description: description || null,
    code: code || null,
    expires_at,
    status: 'active',
    created_at: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ ok: true, id: ref.id })
}

// DELETE ?id= : remove the caller's own deal.
export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const doc = await adminDb.collection('deals').doc(id).get()
  if (!doc.exists) return NextResponse.json({ ok: true })
  if ((doc.data() as any).owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await doc.ref.delete()
  return NextResponse.json({ ok: true })
}
