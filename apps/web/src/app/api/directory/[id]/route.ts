import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { translateTexts } from '@/lib/translate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

function serializeListing(id: string, data: any) {
  return { id, ...data, created_at: toIso(data.created_at), updated_at: toIso(data.updated_at) }
}

// GET: Fetch single listing details
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  try {
    const doc = await adminDb.collection('directory_listings').doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    return NextResponse.json({ listing: serializeListing(doc.id, doc.data()) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH: Update fields by approved owner or admin/editor
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getServerUserProfile(user.id)
  const isEditor = Boolean(profile?.is_editor || profile?.is_developer)

  const ref = adminDb.collection('directory_listings').doc(id)
  const doc = await ref.get()
  if (!doc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = doc.data() as any

  const isOwner = listing.owner_id === user.id && listing.claim_status === 'approved'
  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowedUpdates: Record<string, any> = {}
  for (const f of ['name', 'phone', 'website', 'category', 'address', 'hours']) {
    if (f in body) allowedUpdates[f] = body[f]
  }
  if (listing.tier === 'premium' || listing.tier === 'featured' || isEditor) {
    for (const f of ['description', 'image_url', 'gallery_urls', 'social_links']) {
      if (f in body) allowedUpdates[f] = body[f]
    }
  }
  // Keep the Spanish description in sync so ES visitors (the majority of El Paso)
  // read real Spanish, not English. Best-effort — never blocks the save.
  if ('description' in allowedUpdates) {
    const desc = String(allowedUpdates.description || '').trim()
    if (desc) {
      const tr = await translateTexts([desc]).catch(() => null)
      if (tr && tr[0]) allowedUpdates.description_es = tr[0]
    } else {
      allowedUpdates.description_es = ''
    }
  }

  allowedUpdates.updated_at = new Date().toISOString()

  try {
    await ref.set(allowedUpdates, { merge: true })
    const updated = await ref.get()
    return NextResponse.json({ listing: serializeListing(updated.id, updated.data()) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
