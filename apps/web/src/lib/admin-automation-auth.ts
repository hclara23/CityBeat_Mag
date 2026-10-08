import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'

export async function automationAdmin(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile) || !profile?.mfa_enabled) {
    return { error: NextResponse.json({ error: 'Administrator access and two-factor authentication required' }, { status: 403 }) }
  }
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin')
    const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin
    if (origin !== expected) return { error: NextResponse.json({ error: 'Invalid origin' }, { status: 403 }) }
  }
  return { user }
}
