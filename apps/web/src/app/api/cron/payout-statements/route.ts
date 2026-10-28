import { NextRequest, NextResponse } from 'next/server'
import { reportCronAuthRejected, reportFailure } from '@/lib/alerts'
import { isPayoutCycleDay } from '@/lib/commission-schedule'
import { deliverPayoutStatements } from '@/lib/payout-statement-delivery'
import { payoutCycleStatementPeriod, yearToDateStatementPeriod } from '@/lib/payout-statements'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Operator endpoint for previewing, retrying, or sending a targeted statement.
// Scheduled cycle statements are delivered by the payout cycle itself.
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:payout-statements', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const dryRun = params.get('dryRun') === '1'
  const force = params.get('force') === '1'
  const now = new Date()
  if (!dryRun && !force && !isPayoutCycleDay(now)) {
    return NextResponse.json({ skipped: 'not_a_payout_cycle_day' })
  }

  const payeeUserIds = params.getAll('payee').filter(Boolean)
  const period = params.get('scope') === 'ytd'
    ? yearToDateStatementPeriod(now)
    : payoutCycleStatementPeriod(now)
  try {
    const result = await deliverPayoutStatements({
      period,
      payeeUserIds: payeeUserIds.length ? payeeUserIds : undefined,
      dryRun,
    })
    return NextResponse.json({ ok: true, dry_run: dryRun, period: period.key, ...result })
  } catch (error) {
    if (!dryRun) await reportFailure('cron:payout-statements', error)
    return NextResponse.json({ error: 'Payout statements failed' }, { status: 500 })
  }
}
