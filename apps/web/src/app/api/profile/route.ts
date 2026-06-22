import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPrimaryPlatformRole, hasDeveloperAccess, hasSalesAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

// User-editable profile fields (role flags are intentionally excluded).
const EDITABLE_FIELDS = [
  'full_name',
  'company_name',
  'phone_number',
  'avatar_url',
  'email_notifications_enabled',
  'sms_notifications_enabled',
]

export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  try {
    await adminDb.collection('profiles').doc(user.id).set(updates, { merge: true })
    const doc = await adminDb.collection('profiles').doc(user.id).get()
    return NextResponse.json({ profile: { id: doc.id, ...doc.data() } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not update profile' }, { status: 500 })
  }
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
