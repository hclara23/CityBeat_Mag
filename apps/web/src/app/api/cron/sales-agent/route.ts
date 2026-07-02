import { NextRequest, NextResponse } from 'next/server'
import { runSalesOutreach } from '@/lib/sales-agent'
import { reportFailure } from '@/lib/alerts'

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
    const result = await runSalesOutreach({
      limit: Number(searchParams.get('limit')) || 25,
      dryRun: searchParams.get('dryRun') === '1',
      locale: (searchParams.get('locale') as 'en' | 'es') || 'en',
    })
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:sales-agent', error)
    return NextResponse.json({ error: 'Outreach run failed' }, { status: 500 })
  }
}
