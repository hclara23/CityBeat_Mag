import { NextResponse } from 'next/server'
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

// POST /api/admin/directory/publish-all - publish every hidden directory listing
export async function POST() {
  const cookieStore = getCookieStore()
  const auth = await requireEditor(cookieStore)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createServerClient(cookieStore)

  const { data, error } = await supabase
    .from('directory_listings')
    .update({
      is_published: true,
      updated_at: new Date().toISOString(),
    })
    .eq('is_published', false)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ published: data?.length || 0 })
}
