import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'

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
  if (!hasAdminAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user, profile }
}

// PATCH /api/admin/directory/[id] — update any field on a listing (admin only)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
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

    const ref = adminDb.collection('directory_listings').doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    await ref.set(updates, { merge: true })
    const doc = await ref.get()
    return NextResponse.json({
      listing: { id: doc.id, ...doc.data(), created_at: toIso(doc.data()?.created_at), updated_at: toIso(doc.data()?.updated_at) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/admin/directory/[id] — permanently delete a listing
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    await adminDb.collection('directory_listings').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
