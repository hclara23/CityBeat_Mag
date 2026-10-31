import { NextRequest, NextResponse } from 'next/server'
import { bumpDirectoryIndexVersion } from '@/lib/directory-index-version'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { parsePrintRecognition, type PrintRecognition } from '@/lib/print-recognition'
import { notifyUser } from '@/lib/user-notifications'
import { reviewImportEdit, ImportReviewError } from '@/lib/directory-import-review'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

async function requireEditor() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  // Role AND second factor, together. This checked the role alone, so a staff
  // password with no TOTP enrollment behind it reached this API even though the
  // page in front of it only redirects. See lib/privileged-access.
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return denial
  return { user, profile }
}

// PATCH /api/admin/directory/[id] — update any field on a listing (admin only)
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    let printRecognition: PrintRecognition[] | undefined
    if ('print_recognition' in body) {
      try { printRecognition = parsePrintRecognition(body.print_recognition) }
      catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
    }
    const allowedFields = [
      'name', 'description', 'category', 'address', 'phone', 'website',
      'tier', 'claim_status', 'is_published', 'is_sponsored',
      'image_url', 'gallery_urls', 'social_links', 'hours',
      'owner_id', 'stripe_subscription_id', 'rating', 'user_ratings_total',
    ]
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }
    if (printRecognition) updates.print_recognition = printRecognition

    const ref = adminDb.collection('directory_listings').doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const audit = adminDb.collection('directory_audit_log').doc()
    const owner = await adminDb.runTransaction(async tx => {
      const current = await tx.get(ref)
      if (!current.exists) throw new Error('Listing no longer exists')
      Object.assign(updates, reviewImportEdit(current.data() || {}, updates, body, auth.user.id, updates.updated_at))
      tx.set(ref, updates, { merge: true })
      tx.set(audit, {
        actor_id: auth.user.id, listing_id: id, action: 'admin_listing_edit',
        fields: Object.keys(updates), created_at: updates.updated_at,
        ...(body.approve_import_review === true ? { review_notes: updates.verification_notes, source_url: updates.source_url } : {}),
        ...(printRecognition ? { previous_print_recognition: current.data()?.print_recognition || [], print_recognition: printRecognition } : {}),
      })
      return { ...current.data(), ...updates }
    })
    if (printRecognition && owner?.owner_id && owner.claim_status === 'approved') {
      await notifyUser({ userId: owner.owner_id, notificationId: `print-${audit.id}`, type: 'listing_update',
        title: 'Your CityBeat print recognition was updated', title_es: 'Se actualizaron tus apariciones en CityBeat',
        body: 'View the print magazine appearances recorded on your business profile.',
        body_es: 'Consulta las apariciones en la revista registradas en el perfil de tu negocio.',
        link: `/directory/${encodeURIComponent(id)}` }).catch(() => {})
    }
    await bumpDirectoryIndexVersion('admin:edit')
    const doc = await ref.get()
    return NextResponse.json({
      listing: { id: doc.id, ...doc.data(), created_at: toIso(doc.data()?.created_at), updated_at: toIso(doc.data()?.updated_at) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: e instanceof ImportReviewError ? 400 : 500 })
  }
}

// DELETE /api/admin/directory/[id] — permanently delete a listing
export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    await adminDb.collection('directory_listings').doc(id).delete()
    await bumpDirectoryIndexVersion('admin:delete')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
