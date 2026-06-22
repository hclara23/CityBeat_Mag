import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/supabase/roles'
import { getPayoutSettings, savePayoutSettings } from '@/lib/payouts'

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
  return NextResponse.json({ settings: await getPayoutSettings() })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const patch: any = {}
  if (typeof body.default_payout_percent === 'number') patch.default_payout_percent = body.default_payout_percent
  if (body.service_payout_percent && typeof body.service_payout_percent === 'object') {
    patch.service_payout_percent = body.service_payout_percent
  }
  if (body.user_overrides && typeof body.user_overrides === 'object') {
    patch.user_overrides = body.user_overrides
  }

  try {
    const settings = await savePayoutSettings(patch, auth.user.id)
    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save settings' }, { status: 500 })
  }
}
