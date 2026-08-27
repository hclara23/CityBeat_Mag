import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { runPayoutCycle } from '@/lib/payouts'
import { isPayoutCycleDay } from '@/lib/commission-schedule'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Pays out every commission whose 7-day refund window has closed.
// Scheduled twice a month — the 1st and the 15th (citybeat-payout-cycle).
//
// The scheduler is already set to those two days, but the day is re-checked here
// so a manual or accidental invocation can't pay off-cycle; `?force=1` overrides
// that for a deliberate catch-up run. Dry-run with `?dryRun=1` to see what would
// be paid without moving money.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const force = searchParams.get('force') === '1'

  if (!dryRun && !force && !isPayoutCycleDay(new Date())) {
    return NextResponse.json({
      skipped: 'not_a_payout_cycle_day',
      note: 'Commission pays on the 1st and the 15th. Use ?force=1 for a deliberate catch-up run.',
    })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
  try {
    const result = await runPayoutCycle({
      stripe,
      limit: Number(searchParams.get('limit')) || 200,
      dryRun,
    })
    if (!dryRun) await reportSuccess('cron:payout-cycle')
    return NextResponse.json({ dry_run: dryRun, ...result })
  } catch (error) {
    await reportFailure('cron:payout-cycle', error)
    return NextResponse.json({ error: 'Payout cycle run failed' }, { status: 500 })
  }
}
