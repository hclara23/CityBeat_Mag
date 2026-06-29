import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { getStripe } from '@/lib/platform/stripe-connect'
import { manualPayout } from '@/lib/payouts'

export const dynamic = 'force-dynamic'

// Godmode-only: issue a one-off payout (flat amount in cents) to a user's
// connected bank account. Money moves from the platform Stripe balance to the
// payee via a Stripe transfer and is recorded in the `transfers` ledger.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const payeeUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const amount = Number(body.amount) // cents
  const currency = typeof body.currency === 'string' ? body.currency : 'usd'
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined

  if (!payeeUserId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount (cents) must be greater than 0' }, { status: 400 })
  }

  try {
    const result = await manualPayout({
      stripe: getStripe(),
      payeeUserId,
      amount,
      currency,
      issuedBy: user.id,
      note,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Payout failed' }, { status: 400 })
  }
}
