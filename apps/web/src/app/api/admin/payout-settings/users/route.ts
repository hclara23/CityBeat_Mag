import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPrimaryPlatformRole, hasDeveloperAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Godmode-only: everyone who holds a role in the company (now or added later), so
// the payout UI can pick an individual to set a commission override for — no
// hand-typed UIDs. Returns nothing sensitive (name/email/uid/role only).
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Staff/company roles that can earn commission or manage the platform
  // (advertisers/visitors are customers, not company individuals).
  const COMPANY_ROLES = new Set(['developer', 'admin', 'editor', 'writer', 'sales', 'contributor'])
  const snap = await adminDb.collection('profiles').limit(2000).get()
  const users = snap.docs
    .map((d) => {
      const p = d.data() as any
      const role = getPrimaryPlatformRole({ ...p, id: d.id })
      return { uid: d.id, name: p.full_name || '', email: p.email || '', role }
    })
    .filter((u) => COMPANY_ROLES.has(u.role))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))

  return NextResponse.json({ users })
}
