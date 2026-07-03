import { NextRequest, NextResponse } from 'next/server'
import { runSalesOutreach, runRecoveryOutreach } from '@/lib/sales-agent'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  try {
    const dryRun = searchParams.get('dryRun') === '1'
    const result = await runSalesOutreach({
      limit: Number(searchParams.get('limit')) || 25,
      dryRun,
      locale: (searchParams.get('locale') as 'en' | 'es') || 'en',
    })
    // Mid-funnel recovery rides the same daily run: abandoned verifications and
    // claimed-but-basic owners each get one nudge, tracked in recovery_outreach.
    const recovery = await runRecoveryOutreach({ limit: 20, dryRun })
    await reportSuccess('cron:sales-agent')
    return NextResponse.json({ ...result, recovery })
  } catch (error) {
    await reportFailure('cron:sales-agent', error)
    return NextResponse.json({ error: 'Outreach run failed' }, { status: 500 })
  }
}
