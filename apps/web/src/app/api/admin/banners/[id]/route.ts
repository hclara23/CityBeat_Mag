import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/supabase/roles'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

const PLACEMENTS = ['home_top', 'directory', 'sidebar']
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
