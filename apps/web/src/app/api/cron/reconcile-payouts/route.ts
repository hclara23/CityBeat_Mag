import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { reconcileFailedTransfers } from '@/lib/payouts'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Completes commission transfers that failed at webhook time (e.g. a fresh sale
// whose funds hadn't settled, or a payee whose bank wasn't connected yet). Idempotent
// and safe to run repeatedly — an already-`paid` share is skipped and the stable
// idempotency key prevents any double-pay. Dry-run with `?dryRun=1`.
export async function GET(request: NextRequest) {
  // A rejected BEARER token is our own scheduler running against a rotated or
  // mistyped CRON_SECRET. That silences EVERY job at once, before any of their
  // try/catch blocks can report anything — the whole automation engine stops and
  // the only symptom is that nothing happens. Report it from the 401 itself.
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:reconcile-payouts', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as any })
  const { searchParams } = new URL(request.url)
  try {
    const result = await reconcileFailedTransfers({
      stripe,
      limit: Number(searchParams.get('limit')) || 50,
      dryRun: searchParams.get('dryRun') === '1',
    })
    // The only cron with no liveness stamp at all, so nothing could ever notice it
    // had stopped. What it completes are commission transfers that failed at
    // webhook time — money a rep has already earned. Its silence is expensive and
    // invisible, which is the worst combination.
    // Not stamped on a dry run: that is an operator probe, not a real cycle.
    if (searchParams.get('dryRun') !== '1') await reportSuccess('cron:reconcile-payouts')
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:reconcile-payouts', error)
    return NextResponse.json({ error: 'Payout reconciliation run failed' }, { status: 500 })
  }
}
