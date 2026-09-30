import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { FieldValue } from 'firebase-admin/firestore'
import {
  NEWSLETTER_SLOT_CONFLICT_CODE,
  newsletterSlotConflict,
  newsletterSlotConflictMessage,
  newsletterSlotLabel,
} from '@/lib/newsletter-slot'

export const dynamic = 'force-dynamic'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

const PLACEMENTS = ['home_top', 'directory', 'sidebar', 'newsletter']
const EDITABLE = ['sponsor_name', 'title', 'description', 'image_url', 'link_url', 'is_active']

// PATCH — update a banner
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!params.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, any> = { updated_at: FieldValue.serverTimestamp() }
  for (const f of EDITABLE) if (f in body) updates[f] = body[f]
  if ('placement' in body && PLACEMENTS.includes(body.placement)) updates.placement = body.placement
  if ('locale' in body) updates.locale = body.locale === 'en' || body.locale === 'es' ? body.locale : 'all'
  if ('priority' in body) updates.priority = Number(body.priority) || 0

  const ref = adminDb.collection('ad_banners').doc(params.id)
  const existing = await ref.get()
  if (!existing.exists) return NextResponse.json({ error: 'Banner not found' }, { status: 404 })

  // Judge the doc this PATCH would PRODUCE, not the body it was given. Both of
  // the moves that break the invariant are partial edits: flipping is_active on
  // a paused newsletter banner while another is live, and moving an already-live
  // banner's placement to 'newsletter'. Neither sends both fields, so anything
  // that only inspected the body would wave them through — and the digest sells
  // exactly one "Sponsored by" unit, so the loser is billed for a placement that
  // never renders. Same rule and same 409 the campaign-approval path returns.
  const current = existing.data() as Record<string, any>
  const nextPlacement = 'placement' in updates ? updates.placement : current?.placement
  // Strictly `=== true`, because that is what the production query
  // `.where('is_active','==',true)` matches — anything else is not live.
  const nextActive = 'is_active' in updates ? updates.is_active === true : current?.is_active === true
  if (nextPlacement === 'newsletter' && nextActive) {
    const occupied = await adminDb
      .collection('ad_banners')
      .where('placement', '==', 'newsletter')
      .where('is_active', '==', true)
      .limit(5)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const docs = occupied.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    // Excluding this document is what lets the sitting sponsor be edited in
    // place — renaming it or swapping its creative must not read as a second
    // sponsor conflicting with itself.
    const [conflictId] = newsletterSlotConflict(docs, params.id)
    if (conflictId) {
      return NextResponse.json(
        {
          error: newsletterSlotConflictMessage(
            newsletterSlotLabel(docs.find((d) => d.id === conflictId) || null)
          ),
          code: NEWSLETTER_SLOT_CONFLICT_CODE,
        },
        { status: 409 }
      )
    }
  }

  await ref.set(updates, { merge: true })
  const doc = await ref.get()
  return NextResponse.json({ banner: { id: doc.id, ...doc.data() } })
}

// DELETE — remove a banner
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!params.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await adminDb.collection('ad_banners').doc(params.id).delete()
  return NextResponse.json({ success: true })
}
