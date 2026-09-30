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

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

// 'newsletter' backs the sellable "Sponsored by" slot in the weekly digest
// (cron/newsletter-digest reads ad_banners where placement == 'newsletter').
// It was missing here, so that paid slot was unreachable by any in-product
// action — every attempt silently fell back to 'home_top'.
const PLACEMENTS = ['home_top', 'directory', 'sidebar', 'newsletter']

// GET — list all banners
export async function GET() {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const snap = await adminDb.collection('ad_banners').get()
  const banners = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any), created_at: toIso((d.data() as any).created_at) }))
    .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
  return NextResponse.json({ banners })
}

// POST — create a banner
export async function POST(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const placement = PLACEMENTS.includes(body.placement) ? body.placement : 'home_top'
  const isActive = body.is_active !== false

  // Creating a SECOND live newsletter banner is the same mistake admin/campaigns
  // already refuses when it approves a sponsorship: the weekly digest has exactly
  // one "Sponsored by" unit, so whichever banner loses is billed for a placement
  // that never renders. That check only ever guarded the campaign-approval path,
  // and this route can reach the same collection directly — so the invariant held
  // or not depending on which screen an admin happened to use. Same rule, same
  // 409, one definition in lib/newsletter-slot.
  //
  // Fails OPEN on a read error, exactly as the campaign path does: an admin must
  // not be locked out of banner management by a Firestore hiccup, and the digest
  // now detects and reports a collision that slips through rather than silently
  // rendering an arbitrary one of them.
  if (placement === 'newsletter' && isActive) {
    const occupied = await adminDb
      .collection('ad_banners')
      .where('placement', '==', 'newsletter')
      .where('is_active', '==', true)
      .limit(5)
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const docs = occupied.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    // A document being created has no id yet, so nothing is excluded from the check.
    const [conflictId] = newsletterSlotConflict(docs, null)
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

  const ref = await adminDb.collection('ad_banners').add({
    sponsor_name: body.sponsor_name || null,
    title: body.title || null,
    description: body.description || null,
    image_url: body.image_url || null,
    link_url: body.link_url || null,
    placement,
    locale: body.locale === 'en' || body.locale === 'es' ? body.locale : 'all',
    priority: Number(body.priority) || 0,
    is_active: isActive,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })
  const doc = await ref.get()
  return NextResponse.json(
    { banner: { id: doc.id, ...doc.data(), created_at: toIso(doc.data()?.created_at) } },
    { status: 201 }
  )
}
