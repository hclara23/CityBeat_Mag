import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { runReferralQualification } from '@/lib/referrals-server'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Daily: qualify referred directory subscriptions that have remained active for
// three calendar months, credit the referrer's ledger, and synchronize Stripe.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })
  const { searchParams } = new URL(request.url)
  try {
    const result = await runReferralQualification({
      stripe,
      limit: Number(searchParams.get('limit')) || 200,
      dryRun: searchParams.get('dryRun') === '1',
    })
    await reportSuccess('cron:referrals')
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:referrals', error)
    return NextResponse.json({ error: 'Referral qualification run failed' }, { status: 500 })
  }
}
