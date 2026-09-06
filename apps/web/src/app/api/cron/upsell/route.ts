import { NextRequest, NextResponse } from 'next/server'
import { runUpsellOutreach } from '@/lib/sales-agent'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  // A rejected BEARER token is our own scheduler running against a rotated or
  // mistyped CRON_SECRET. That silences EVERY job at once, before any of their
  // try/catch blocks can report anything — the whole automation engine stops and
  // the only symptom is that nothing happens. Report it from the 401 itself.
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:upsell', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  try {
    const result = await runUpsellOutreach({
      limit: Number(searchParams.get('limit')) || 20,
      dryRun: searchParams.get('dryRun') === '1',
      locale: (searchParams.get('locale') as 'en' | 'es') || 'en',
    })
    await reportSuccess('cron:upsell')
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:upsell', error)
    return NextResponse.json({ error: 'Upsell run failed' }, { status: 500 })
  }
}
