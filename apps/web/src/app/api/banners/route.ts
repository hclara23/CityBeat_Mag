import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Public: active ad banners for a given placement + locale.
// Placements: 'home_top', 'home_mid', 'directory_sidebar'.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const placement = searchParams.get('placement') || ''
  const locale = searchParams.get('locale') || 'en'

  try {
    const snap = await adminDb.collection('ad_banners').where('is_active', '==', true).get()
    let rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))

    if (placement) rows = rows.filter((r: any) => r.placement === placement)
    rows = rows.filter((r: any) => !r.locale || r.locale === 'all' || r.locale === locale)
    rows.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))

    const banners = rows.map((r: any) => ({
      id: r.id,
      sponsor_name: r.sponsor_name || null,
      title: r.title || null,
      description: r.description || null,
      image_url: r.image_url || null,
      link_url: r.link_url || null,
      placement: r.placement,
    }))

    return NextResponse.json({ banners })
  } catch (error: any) {
    return NextResponse.json({ banners: [], error: error.message }, { status: 200 })
  }
}
