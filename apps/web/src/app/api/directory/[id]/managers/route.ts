import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb, adminAuth } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { normalizeSalesEmail, isValidSalesEmail } from '@/lib/sales-checkout'
import { notifyUser } from '@/lib/user-notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Team & Access: invite/revoke additional managers for a listing. Only the
// approved OWNER (or staff) may manage the team — managers cannot add or remove
// other managers. Seats are capped by the plan's additionalManagers entitlement,
// enforced server-side.

type ManagerContext = {
  user: { id: string; email?: string | null }
  listing: Record<string, any>
  listingRef: FirebaseFirestore.DocumentReference
  entitlements: ReturnType<typeof resolveEntitlements>
  isStaff: boolean
  isOwner: boolean
}

async function authorizeTeamAccess(
  listingId: string
): Promise<{ ok: true; ctx: ManagerContext } | { ok: false; res: NextResponse }> {
  const user = await getServerUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const profile = await getServerUserProfile(user.id)
  const isStaff = hasEditorAccess(profile)

  const listingRef = adminDb.collection('directory_listings').doc(listingId)
  const doc = await listingRef.get()
  if (!doc.exists) {
    return { ok: false, res: NextResponse.json({ error: 'Listing not found' }, { status: 404 }) }
  }
  const listing = doc.data() as Record<string, any>
  const entitlements = resolveEntitlements(listing)
  const { isOwner } = resolveListingPatchAccess(listing, { userId: user.id, isStaff })
  if (!isOwner && !isStaff) {
    return { ok: false, res: NextResponse.json({ error: 'Only the listing owner can manage the team.' }, { status: 403 }) }
  }
  return { ok: true, ctx: { user, listing, listingRef, entitlements, isStaff, isOwner } }
}

function managerIds(listing: Record<string, any>): string[] {
  return Array.isArray(listing.manager_ids)
    ? listing.manager_ids.filter((v: unknown) => typeof v === 'string')
    : []
}

// GET: the current team (owner + staff only — includes manager emails).
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  const auth = await authorizeTeamAccess(params.id)
  if (!auth.ok) return auth.res
  const { listing, entitlements } = auth.ctx

  const ids = managerIds(listing)
  const managers = await Promise.all(
    ids.map(async (uid) => {
      try {
        const record = await adminAuth.getUser(uid)
        return { user_id: uid, email: record.email || null, name: record.displayName || null }
      } catch {
        return { user_id: uid, email: null, name: null }
      }
    })
  )
  return NextResponse.json({
    managers,
    limit: entitlements.additionalManagers,
    seats_used: ids.length,
  })
}

// POST { email }: invite a manager by email. The person must already have a
// CityBeat account (matching Firebase Auth email) so access binds to a real,
// authenticated identity.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  const auth = await authorizeTeamAccess(params.id)
  if (!auth.ok) return auth.res
  const { user, listing, listingRef, entitlements, isStaff } = auth.ctx

  if (!isStaff && entitlements.additionalManagers <= 0) {
    return NextResponse.json({ error: 'Your plan does not include team seats.', code: 'not_entitled' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const email = normalizeSalesEmail(body.email)
  if (!email || !isValidSalesEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  let target: { uid: string; email?: string } | null = null
  try {
    const record = await adminAuth.getUserByEmail(email)
    target = { uid: record.uid, email: record.email }
  } catch {
    return NextResponse.json(
      {
        error: 'No CityBeat account exists for that email. Ask them to create a free account first, then invite them.',
        code: 'no_account',
      },
      { status: 404 }
    )
  }

  const ids = managerIds(listing)
  if (target.uid === listing.owner_id) {
    return NextResponse.json({ error: 'That person already owns this listing.' }, { status: 409 })
  }
  if (ids.includes(target.uid)) {
    return NextResponse.json({ error: 'That person is already a manager.' }, { status: 409 })
  }
  if (!isStaff && ids.length >= entitlements.additionalManagers) {
    return NextResponse.json(
      { error: `Your plan includes ${entitlements.additionalManagers} manager seat(s). Remove one first or upgrade.`, code: 'seats_full' },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  await listingRef.set({ manager_ids: [...ids, target.uid], updated_at: now }, { merge: true })
  // Accountability: team changes are always audited.
  void adminDb
    .collection('directory_audit_log')
    .add({
      actor_id: user.id,
      listing_id: params.id,
      action: 'manager_added',
      target_user_id: target.uid,
      created_at: now,
    })
    .catch(() => {})

  // Tell the invited manager (first-party inbox + email).
  const bizName = String(listing.name || 'a business')
  await notifyUser({
    userId: target.uid,
    type: 'manager_added',
    title: `You can now manage ${bizName} on CityBeat`,
    title_es: `Ya puedes administrar ${bizName} en CityBeat`,
    body: 'The owner added you as a listing manager. Open the dashboard to start editing.',
    body_es: 'El dueño te agregó como administrador de la ficha. Abre el panel para empezar a editar.',
    link: `/dashboard/listings/${params.id}`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, manager: { user_id: target.uid, email: target.email || email } })
}

// DELETE { userId }: revoke a manager.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  const auth = await authorizeTeamAccess(params.id)
  if (!auth.ok) return auth.res
  const { user, listing, listingRef } = auth.ctx

  const body = await request.json().catch(() => ({}))
  const targetId = typeof body.userId === 'string' ? body.userId : ''
  const ids = managerIds(listing)
  if (!targetId || !ids.includes(targetId)) {
    return NextResponse.json({ error: 'That person is not a manager of this listing.' }, { status: 404 })
  }

  const now = new Date().toISOString()
  await listingRef.set(
    { manager_ids: ids.filter((id) => id !== targetId), updated_at: now },
    { merge: true }
  )
  void adminDb
    .collection('directory_audit_log')
    .add({
      actor_id: user.id,
      listing_id: params.id,
      action: 'manager_removed',
      target_user_id: targetId,
      created_at: now,
    })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
