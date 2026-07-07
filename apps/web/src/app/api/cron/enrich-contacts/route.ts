import { NextRequest, NextResponse } from 'next/server'
import { runContactEnrichment } from '@/lib/enrich-contacts'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit')) || 25
  // ?categories=Real Estate,Attorneys targets a specific vertical.
  const categories = (searchParams.get('categories') || '').split(',').map((c) => c.trim()).filter(Boolean)
  try {
    const result = await runContactEnrichment({ limit, categories: categories.length ? categories : undefined })
    await reportSuccess('cron:enrich-contacts')
    return NextResponse.json(result)
  } catch (error) {
    await reportFailure('cron:enrich-contacts', error, { limit })
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
