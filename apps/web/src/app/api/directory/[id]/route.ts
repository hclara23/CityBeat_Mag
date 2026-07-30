import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { translateTexts } from '@/lib/translate'
import { isSalesCreatedDirectoryListing } from '@/lib/sales-directory'
import { hasEditorAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

function maskClaimContact(value: unknown, type: 'email' | 'phone'): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  if (type === 'email') {
    const [local, domain] = normalized.split('@')
    if (!local || !domain) return null
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
  }
  const digits = normalized.replace(/\D/g, '')
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null
}

function serializeListing(id: string, data: any) {
  const listing: Record<string, any> = {
    id,
    ...data,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
    sales_created_listing: isSalesCreatedDirectoryListing(data),
    claim_contact_email_hint: maskClaimContact(data.email || data.contact_email, 'email'),
    claim_contact_phone_hint: maskClaimContact(data.phone, 'phone'),
  }
  for (const field of [
    'email',
    'contact_email',
    'stripe_customer_id',
    'stripe_subscription_id',
    'sales_created_by',
    'sold_by_rep',
    'sales_order_id',
    'requested_product_id',
  ]) {
    delete listing[field]
  }
  return listing
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
  const isEditor = hasEditorAccess(profile)

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
