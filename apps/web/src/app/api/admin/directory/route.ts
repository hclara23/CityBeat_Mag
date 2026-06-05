import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  }
}

async function requireEditor(cookieStore: ReturnType<typeof getCookieStore>) {
  const user = await getServerUser(cookieStore)
  if (!user) return { error: 'Unauthorized', status: 401 }
  const profile = await getServerUserProfile(user.id, cookieStore)
  if (!hasAdminAccess(profile)) return { error: 'Forbidden', status: 403 }
  return { user, profile }
}

// GET /api/admin/directory — fetch all listings with optional search/filter
export async function GET(request: NextRequest) {
  const cookieStore = getCookieStore()
  const auth = await requireEditor(cookieStore)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const tier = searchParams.get('tier') || ''
  const claim_status = searchParams.get('claim_status') || ''
  const is_sponsored = searchParams.get('is_sponsored') || ''
  const is_published = searchParams.get('is_published') || ''

  const supabase = createServerClient(cookieStore)

  let query = supabase
    .from('directory_listings')
    .select('*, profiles:owner_id (email, full_name, phone_number)')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,category.ilike.%${search}%`)
  }
  if (category) query = query.eq('category', category)
  if (tier) query = query.eq('tier', tier)
  if (claim_status) query = query.eq('claim_status', claim_status)
  if (is_sponsored === 'true') query = query.eq('is_sponsored', true)
  if (is_sponsored === 'false') query = query.eq('is_sponsored', false)
  if (is_published === 'true') query = query.eq('is_published', true)
  if (is_published === 'false') query = query.eq('is_published', false)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ listings: data || [] })
}

// POST /api/admin/directory — create a new listing
export async function POST(request: NextRequest) {
  const cookieStore = getCookieStore()
  const auth = await requireEditor(cookieStore)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createServerClient(cookieStore)

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

    const { data, error } = await supabase
      .from('directory_listings')
      .insert({
        name, category, address, phone, website, description,
        tier, claim_status, is_published, is_sponsored,
        image_url: image_url || null,
        gallery_urls: gallery_urls || [],
        social_links: social_links || {},
        hours: hours || {},
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ listing: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
