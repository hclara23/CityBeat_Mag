import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'
import {
  canManageRole,
  getPrimaryPlatformRole,
  hasAdminAccess,
  hasDeveloperAccess,
  hasSalesAccess,
  normalizeRequestedRoles,
  type PlatformRole,
} from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  }
}

async function getProfileWithRoles(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, profile_roles(role, revoked_at)')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

function roleColumnGrantUpdates(roles: PlatformRole[]) {
  const roleSet = new Set(roles)
  const updates: Record<string, unknown> = {}

  if (roleSet.has('developer')) {
    updates.is_developer = true
    updates.is_editor = true
    updates.is_writer = true
    updates.role = 'developer'
  } else if (roleSet.has('admin')) {
    updates.is_editor = true
    updates.is_writer = true
    updates.role = 'admin'
  } else if (roleSet.has('editor')) {
    updates.is_editor = true
    updates.is_writer = true
    updates.role = 'editor'
  } else if (roleSet.has('writer')) {
    updates.is_writer = true
    updates.role = 'writer'
  } else if (roleSet.has('sales')) {
    updates.is_sales = true
    updates.sales_dashboard_enabled = true
    updates.role = 'sales'
  } else if (roleSet.has('contributor')) {
    updates.role = 'contributor'
  } else if (roleSet.has('advertiser')) {
    updates.is_advertiser = true
    updates.role = 'advertiser'
  }

  if (roleSet.has('sales')) {
    updates.is_sales = true
    updates.sales_dashboard_enabled = true
  }
  if (roleSet.has('advertiser')) updates.is_advertiser = true

  return updates
}

export async function GET() {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(cookieStore)
  const profile = await getProfileWithRoles(supabase, user.id)

  return NextResponse.json({
    profile: {
      ...profile,
      id: user.id,
      email: profile?.email ?? user.email,
      primary_role: getPrimaryPlatformRole(profile),
      can_manage_platform: hasDeveloperAccess(profile),
      can_manage_sales: hasAdminAccess(profile),
      sales_dashboard_enabled: hasSalesAccess(profile),
    },
  })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(cookieStore)
  const actor = await getProfileWithRoles(supabase, user.id)
  if (!hasAdminAccess(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const targetUserId = typeof body.userId === 'string' ? body.userId : ''
  const roles = normalizeRequestedRoles(body.roles)

  if (!targetUserId || roles.length === 0) {
    return NextResponse.json({ error: 'userId and roles are required' }, { status: 400 })
  }

  const disallowed = roles.filter((role) => !canManageRole(actor, role))
  if (disallowed.length > 0) {
    return NextResponse.json({ error: `Not allowed to grant: ${disallowed.join(', ')}` }, { status: 403 })
  }

  const target = await getServerUserProfile(targetUserId, cookieStore)
  if (!target) return NextResponse.json({ error: 'Target profile not found' }, { status: 404 })
  if (!hasDeveloperAccess(actor) && hasDeveloperAccess(target)) {
    return NextResponse.json({ error: 'Target profile not found' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(roleColumnGrantUpdates(roles))
    .eq('id', targetUserId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const rows = roles.map((role) => ({
    profile_id: targetUserId,
    role,
    granted_by: user.id,
    revoked_at: null,
  }))

  const { error: roleError } = await supabase
    .from('profile_roles')
    .upsert(rows, { onConflict: 'profile_id,role' })

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  const updated = await getProfileWithRoles(supabase, targetUserId)
  return NextResponse.json({ profile: updated })
}
