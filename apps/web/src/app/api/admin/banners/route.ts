import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { FieldValue } from 'firebase-admin/firestore'

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
  return { user }
}

const PLACEMENTS = ['home_top', 'directory', 'sidebar']

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

  const ref = await adminDb.collection('ad_banners').add({
    sponsor_name: body.sponsor_name || null,
    title: body.title || null,
    description: body.description || null,
    image_url: body.image_url || null,
    link_url: body.link_url || null,
    placement,
    locale: body.locale === 'en' || body.locale === 'es' ? body.locale : 'all',
    priority: Number(body.priority) || 0,
    is_active: body.is_active !== false,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })
  const doc = await ref.get()
  return NextResponse.json(
    { banner: { id: doc.id, ...doc.data(), created_at: toIso(doc.data()?.created_at) } },
    { status: 201 }
  )
}
