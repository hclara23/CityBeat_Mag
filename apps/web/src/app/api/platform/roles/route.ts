import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import {
  canManageRole,
  getPrimaryPlatformRole,
  hasAdminAccess,
  hasDeveloperAccess,
  hasSalesAccess,
  normalizeRequestedRoles,
  type PlatformRole,
} from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

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
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getServerUserProfile(user.id)

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
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const actor = await getServerUserProfile(user.id)
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

  const targetDoc = await adminDb.collection('profiles').doc(targetUserId).get()
  if (!targetDoc.exists) {
    return NextResponse.json({ error: 'Target profile not found' }, { status: 404 })
  }
  const target = targetDoc.data()
  // Non-developers cannot modify developer accounts.
  if (!hasDeveloperAccess(actor) && hasDeveloperAccess(target)) {
    return NextResponse.json({ error: 'Target profile not found' }, { status: 404 })
  }

  try {
    const updates = {
      ...roleColumnGrantUpdates(roles),
      granted_roles: roles,
      updated_at: new Date().toISOString(),
    }
    await adminDb.collection('profiles').doc(targetUserId).set(updates, { merge: true })
    const updated = await adminDb.collection('profiles').doc(targetUserId).get()
    return NextResponse.json({ profile: { id: updated.id, ...updated.data() } })
  } catch (error: any) {
    console.error('roles PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
