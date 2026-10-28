import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { getPayoutSettings, savePayoutSettings } from '@/lib/payouts'
import { normalizeSplitOverrides } from '@/lib/payout-split'

export const dynamic = 'force-dynamic'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
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
  // These fields are NOT read by the payout engine: payoutSplit/computeSplit
  // use the SPLIT_RATES table plus split_overrides only. Accepting them let a
  // godmode operator set "directory: 50%" that silently did nothing (the live
  // settings doc really contains that value). Rejecting is kinder than
  // ignoring — it tells the caller which knob actually works.
  // user_overrides joins them for exactly the same reason. It is read only by
  // resolvePayoutPercent, whose only caller is payoutToUser — which payouts.ts
  // documents as "DEPRECATED — DO NOT USE FOR COMMISSION… It has no callers."
  // The live engine uses computeSplit + split_overrides. So a godmode operator
  // could set a per-user commission percent, get a 200, watch it persist, and
  // have it change nothing about what anyone is paid: precisely the silent
  // no-op this adjacent guard was added to stop.
  if ('service_payout_percent' in body || 'default_payout_percent' in body || 'user_overrides' in body) {
    return NextResponse.json(
      { error: 'service_payout_percent/default_payout_percent/user_overrides are not read by the payout engine. Configure split_overrides (per-user percents) instead.' },
      { status: 400 }
    )
  }
  const patch: any = {}
  // Per-individual commission split overrides — sanitized server-side (valid
  // UIDs, percents clamped 0–100). Full replace of the map.
  if ('split_overrides' in body) {
    patch.split_overrides = normalizeSplitOverrides(body.split_overrides)
  }
  if (body.commission_mode === 'one_time' || body.commission_mode === 'residual') {
    patch.commission_mode = body.commission_mode
  }
  if (typeof body.editor_user_id === 'string' && body.editor_user_id.trim()) {
    patch.editor_user_id = body.editor_user_id.trim()
  }

  try {
    const settings = await savePayoutSettings(patch, auth.user.id)
    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save settings' }, { status: 500 })
  }
}
