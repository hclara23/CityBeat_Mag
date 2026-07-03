import { NextRequest, NextResponse } from 'next/server'
import { runAccountManager } from '@/lib/account-manager'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Weekly: generate draft marketing work product for every paying listing.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  try {
    const result = await runAccountManager({
      limit: Number(searchParams.get('limit')) || 20,
      dryRun: searchParams.get('dryRun') === '1',
    })
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:account-manager', error)
    return NextResponse.json({ error: 'Account manager run failed' }, { status: 500 })
  }
}
