import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Customer Q&A — Google Business Profile parity. The public asks a question on a
// listing; the owner (or another customer) answers. Public GET returns answered
// + unanswered questions; POST asks a new one and notifies the owner.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const snap = await adminDb
      .collection('listing_questions')
      .where('listing_id', '==', id)
      .limit(100)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const questions = snap.docs
      .map((d) => {
        const x = d.data() as any
        return {
          id: d.id,
          question: x.question,
          asker_name: x.asker_name || 'A customer',
          answer: x.answer || null,
          answered_by: x.answer_by_owner ? 'owner' : x.answer ? 'community' : null,
          created_at: typeof x.created_at === 'string' ? x.created_at : null,
        }
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    return NextResponse.json({ questions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not load questions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Sign in to ask a question.' }, { status: 401 })

  const rl = await checkRateLimit(`listing-question:ip:${getClientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many questions. Please try again later.' }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : ''
  if (question.length < 5) return NextResponse.json({ error: 'Please write a real question.' }, { status: 400 })

  const listingSnap = await adminDb.collection('directory_listings').doc(id).get()
  if (!listingSnap.exists) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  const listing = listingSnap.data() as any

  const profileSnap = await adminDb.collection('profiles').doc(user.id).get()
  const askerName = profileSnap.exists ? (profileSnap.data() as any)?.full_name : null

  const qRef = adminDb.collection('listing_questions').doc()
  await qRef.set({
    listing_id: id,
    question,
    asker_id: user.id,
    asker_name: askerName || 'A customer',
    answer: null,
    created_at: FieldValue.serverTimestamp(),
  })

  if (listing.owner_id) {
    await notifyUser({
      userId: String(listing.owner_id),
      notificationId: `listing_comment:${qRef.id}`,
      type: 'listing_comment',
      title: `New question on ${listing.name || 'your business'}`,
      title_es: `Nueva pregunta en ${listing.name || 'tu negocio'}`,
      body: 'A customer asked a question on your listing — answer it to help them decide.',
      body_es: 'Un cliente hizo una pregunta en tu ficha — respóndela para ayudarle a decidir.',
      link: `/dashboard/listings/${id}`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, id: qRef.id }, { status: 201 })
}
