import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { consolidateListings } from '@/lib/directory-consolidate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  // Role AND second factor, together. This checked the role alone, so a staff
  // password with no TOTP enrollment behind it reached this API even though the
  // page in front of it only redirects. See lib/privileged-access.
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return denial
  return { user }
}

// GET  → dry run (plan only). POST {apply:true, names?:[]} → execute.
// Merges same-brand listings into one multi-location card (locations[]), unpublishing
// siblings with merged_into (reversible). Godmode only.
export async function GET() {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const result = await consolidateListings({ apply: false })
  return NextResponse.json({ dryRun: true, ...result })
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const names = Array.isArray(body.names) ? body.names.map(String) : undefined
  const result = await consolidateListings({ apply: body.apply === true, names })
  return NextResponse.json({ dryRun: body.apply !== true, ...result })
}
