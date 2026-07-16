import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { getPlatformSettings, savePlatformSettings } from '@/lib/platform-settings'

export const dynamic = 'force-dynamic'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

export async function GET() {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ settings: await getPlatformSettings() })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const patch: any = {}
  if (typeof body.auto_approve_claims === 'boolean') patch.auto_approve_claims = body.auto_approve_claims
  if (typeof body.newsroom_auto_publish === 'boolean') patch.newsroom_auto_publish = body.newsroom_auto_publish

  const settings = await savePlatformSettings(patch, auth.user.id)
  return NextResponse.json({ settings })
}
