import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// Owner's AI-drafted marketing work product (dashboard). GET lists drafts;
// POST approves or dismisses one item. Nothing publishes without approval here.

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const snap = await adminDb.collection('ai_workproduct').where('owner_id', '==', user.id).get()
    const drafts = snap.docs
      .map((d) => {
        const x = d.data() as any
        return {
          id: d.id,
          listing_id: x.listing_id,
          business_name: x.business_name,
          status: x.status,
          deal: x.deal || null,
          captions: x.captions || [],
          review_replies: x.review_replies || [],
          created_at: x.created_at?.toDate?.()?.toISOString() || null,
        }
      })
      .filter((d) => d.status === 'draft')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 10)
    return NextResponse.json({ drafts })
  } catch {
    return NextResponse.json({ error: 'Could not load' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workId = typeof body.workId === 'string' ? body.workId : ''
  const action = typeof body.action === 'string' ? body.action : '' // approve_deal | approve_reply | dismiss
  const reviewId = typeof body.reviewId === 'string' ? body.reviewId : ''
  if (!workId || !action) return NextResponse.json({ error: 'workId and action required' }, { status: 400 })

  const ref = adminDb.collection('ai_workproduct').doc(workId)
  const doc = await ref.get()
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const work = doc.data() as any
  if (work.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  if (action === 'dismiss') {
    await ref.set({ status: 'dismissed', updated_at: now }, { merge: true })
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve_deal') {
    if (!work.deal?.title) return NextResponse.json({ error: 'No deal in this draft' }, { status: 400 })
    // Same ownership + paid-tier rules as manual deal posting.
    const lDoc = await adminDb.collection('directory_listings').doc(work.listing_id).get()
    const l = lDoc.exists ? (lDoc.data() as any) : null
    if (!l || l.owner_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
    if (l.tier !== 'premium' && l.tier !== 'featured') {
      return NextResponse.json({ error: 'Deals are a Premium feature.' }, { status: 402 })
    }
    const deal = await adminDb.collection('deals').add({
      listing_id: work.listing_id,
      owner_id: user.id,
      business_name: l.name || null,
      title: String(work.deal.title).slice(0, 120),
      description: String(work.deal.description || '').slice(0, 500) || null,
      code: null,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'active',
      source: 'ai_assistant',
      created_at: FieldValue.serverTimestamp(),
    })
    await ref.set({ deal_approved_at: now, deal_id: deal.id, updated_at: now }, { merge: true })
    return NextResponse.json({ ok: true, dealId: deal.id })
  }

  if (action === 'approve_reply') {
    const reply = (work.review_replies || []).find((r: any) => r.review_id === reviewId)
    if (!reply) return NextResponse.json({ error: 'Reply not found in draft' }, { status: 404 })
    const revRef = adminDb.collection('directory_reviews').doc(reviewId)
    const revDoc = await revRef.get()
    const rev = revDoc.exists ? (revDoc.data() as any) : null
    if (!rev || rev.listing_id !== work.listing_id) return NextResponse.json({ error: 'Review mismatch' }, { status: 400 })
    // Confirm the caller still owns the listing the review belongs to.
    const lDoc = await adminDb.collection('directory_listings').doc(work.listing_id).get()
    if (!lDoc.exists || (lDoc.data() as any).owner_id !== user.id) {
      return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
    }
    await revRef.set({ owner_response: String(reply.reply).slice(0, 600), owner_response_at: now }, { merge: true })
    const remaining = (work.review_replies || []).filter((r: any) => r.review_id !== reviewId)
    await ref.set({ review_replies: remaining, updated_at: now }, { merge: true })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
