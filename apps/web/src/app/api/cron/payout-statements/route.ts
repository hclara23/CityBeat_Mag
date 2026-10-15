import { NextRequest, NextResponse } from 'next/server'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
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

// Retries the statement created by the payout-cycle route. It runs one hour
// after transfers on the 15th and possible month-end dates; the local-day guard
// skips the 28th-30th unless that date is actually the month's final day.
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
    if (!dryRun) await reportSuccess('cron:payout-statements')
    return NextResponse.json({ ok: true, dry_run: dryRun, period: period.key, ...result })
  } catch (error) {
    await reportFailure('cron:payout-statements', error)
    return NextResponse.json({ error: 'Payout statements failed' }, { status: 500 })
  }
}
