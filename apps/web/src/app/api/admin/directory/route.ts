import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
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

// GET /api/admin/directory — fetch all listings with optional search/filter
export async function GET(request: NextRequest) {
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') || '').toLowerCase()
  const category = searchParams.get('category') || ''
  const tier = searchParams.get('tier') || ''
  const claim_status = searchParams.get('claim_status') || ''
  const is_sponsored = searchParams.get('is_sponsored') || ''
  const is_published = searchParams.get('is_published') || ''

  try {
    let query: any = adminDb.collection('directory_listings')
    if (category) query = query.where('category', '==', category)
    if (tier) query = query.where('tier', '==', tier)
    if (claim_status) query = query.where('claim_status', '==', claim_status)
    if (is_sponsored === 'true') query = query.where('is_sponsored', '==', true)
    if (is_sponsored === 'false') query = query.where('is_sponsored', '==', false)
    if (is_published === 'true') query = query.where('is_published', '==', true)
    if (is_published === 'false') query = query.where('is_published', '==', false)

    const snap = await query.get()
    let listings = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
      created_at: toIso(d.data().created_at),
      updated_at: toIso(d.data().updated_at),
    }))

    if (search) {
      listings = listings.filter((l: any) =>
        [l.name, l.address, l.category].some((v: any) => String(v || '').toLowerCase().includes(search))
      )
    }
    listings.sort((a: any, b: any) => (String(b.created_at) > String(a.created_at) ? 1 : -1))

    return NextResponse.json({ listings })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/admin/directory — create a new listing
export async function POST(request: NextRequest) {
  const auth = await requireEditor()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const {
      name, category, address, phone, website, description,
      tier = 'basic', claim_status = 'unclaimed',
      is_published = true, is_sponsored = false,
      image_url, gallery_urls, social_links, hours,
    } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 })
    }

    const docRef = await adminDb.collection('directory_listings').add({
      name, category, address: address || null, phone: phone || null,
      website: website || null, description: description || null,
      tier, claim_status, is_published, is_sponsored,
      image_url: image_url || null,
      gallery_urls: gallery_urls || [],
      social_links: social_links || {},
      hours: hours || {},
      owner_id: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })
    const doc = await docRef.get()
    return NextResponse.json(
      { listing: { id: doc.id, ...doc.data(), created_at: toIso(doc.data()?.created_at), updated_at: toIso(doc.data()?.updated_at) } },
      { status: 201 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
