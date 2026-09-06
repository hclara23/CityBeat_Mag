import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Answer a customer question. The business side — the owner of an APPROVED claim
// and their seated managers — has its answer flagged as authoritative
// (answer_by_owner). Staff may also answer, as the community. Notifies the asker.
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
  // Who may answer. This used a raw `listing.owner_id === user.id`, which is NOT
  // the ownership rule the rest of the directory uses: resolveListingPatchAccess
  // additionally requires claim_status === 'approved'. owner_id is written when a
  // claim is SUBMITTED, so someone whose claim an admin had not approved (or had
  // rejected) could post an answer that renders on the public listing flagged as
  // the business's own — impersonation on a page the real owner does not control
  // yet. It also ignored the paid manager seats.
  const entitlements = resolveEntitlements(listing)
  const { canManage, isOwner, isManager } = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff: hasEditorAccess(profile),
    managerAllowance: entitlements.additionalManagers,
  })
  if (!canManage) {
    return NextResponse.json({ error: 'Only the business owner can answer questions.' }, { status: 403 })
  }
  // "The business answered" covers the owner and their seated managers; a staff
  // editor answering is not the business, so their answer stays a community one.
  const answeredByBusiness = isOwner || isManager

  const qRef = adminDb.collection('listing_questions').doc(questionId)
  const qSnap = await qRef.get()
  if (!qSnap.exists) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  const q = qSnap.data() as any
  if (q.listing_id !== id) return NextResponse.json({ error: 'Question does not belong to this listing' }, { status: 400 })

  const now = new Date().toISOString()
  await qRef.set(
    { answer, answer_by_owner: answeredByBusiness, answered_by: user.id, answered_at: now },
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
