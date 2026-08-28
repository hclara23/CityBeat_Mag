import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Answer a customer question. The listing OWNER's answer is flagged as
// authoritative (answer_by_owner). Staff may also answer. Notifies the asker.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await params
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)

  const body = await request.json().catch(() => ({}))
  const answer = typeof body.answer === 'string' ? body.answer.trim().slice(0, 1000) : ''
  if (answer.length < 2) return NextResponse.json({ error: 'Write an answer.' }, { status: 400 })

  const listingSnap = await adminDb.collection('directory_listings').doc(id).get()
  if (!listingSnap.exists) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  const listing = listingSnap.data() as any
  const isOwner = listing.owner_id && listing.owner_id === user.id
  if (!isOwner && !hasEditorAccess(profile)) {
    return NextResponse.json({ error: 'Only the business owner can answer questions.' }, { status: 403 })
  }

  const qRef = adminDb.collection('listing_questions').doc(questionId)
  const qSnap = await qRef.get()
  if (!qSnap.exists) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  const q = qSnap.data() as any
  if (q.listing_id !== id) return NextResponse.json({ error: 'Question does not belong to this listing' }, { status: 400 })

  const now = new Date().toISOString()
  await qRef.set(
    { answer, answer_by_owner: Boolean(isOwner), answered_by: user.id, answered_at: now },
    { merge: true }
  )

  // Tell the person who asked that they got an answer.
  if (q.asker_id) {
    await notifyUser({
      userId: String(q.asker_id),
      notificationId: `question_answered:${questionId}`,
      type: 'review_reply',
      title: `Answered: your question about ${listing.name || 'a business'}`,
      title_es: `Respondida: tu pregunta sobre ${listing.name || 'un negocio'}`,
      body: 'The business answered your question on CityBeat.',
      body_es: 'El negocio respondió tu pregunta en CityBeat.',
      link: `/directory/${id}`,
      emailChannel: false,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
