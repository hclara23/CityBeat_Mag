import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'
import { getPrimaryPlatformRole, hasDeveloperAccess, hasSalesAccess } from '@citybeat/lib/supabase/roles'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

export async function GET() {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id, cookieStore)

  return NextResponse.json({
    profile: {
      ...profile,
      id: user.id,
      email: profile?.email ?? user.email,
      primary_role: getPrimaryPlatformRole(profile),
      is_developer: profile?.is_developer ?? false,
      is_editor: profile?.is_editor ?? false,
      is_writer: profile?.is_writer ?? false,
      is_sales: profile?.is_sales ?? false,
      can_manage_platform: hasDeveloperAccess(profile),
      sales_dashboard_enabled: hasSalesAccess(profile),
    },
  })
}
