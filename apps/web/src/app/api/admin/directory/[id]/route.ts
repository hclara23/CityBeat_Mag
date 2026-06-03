import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'

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
  if (!profile?.is_editor) return { error: 'Forbidden', status: 403 }
  return { user, profile }
}

// PATCH /api/admin/directory/[id] — update any field on a listing (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const cookieStore = getCookieStore()
  const auth = await requireEditor(cookieStore)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createServerClient(cookieStore)

  try {
    const body = await request.json()

    // Admin can update any field
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

    const { data, error } = await supabase
      .from('directory_listings')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ listing: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/admin/directory/[id] — permanently delete a listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const cookieStore = getCookieStore()
  const auth = await requireEditor(cookieStore)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createServerClient(cookieStore)

  const { error } = await supabase
    .from('directory_listings')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
