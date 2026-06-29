import { NextRequest, NextResponse } from 'next/server'
import { runUpsellOutreach } from '@/lib/sales-agent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const result = await runUpsellOutreach({
    limit: Number(searchParams.get('limit')) || 20,
    dryRun: searchParams.get('dryRun') === '1',
    locale: (searchParams.get('locale') as 'en' | 'es') || 'en',
  })
  return NextResponse.json(result)
}
