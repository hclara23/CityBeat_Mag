import { NextRequest, NextResponse } from 'next/server'
import { ensureSeeded, runDueWorkflows } from '@/lib/scrapeflow'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Cloud Scheduler: `citybeat-scrapeflow` → GET /api/cron/scrapeflow?limit=3
// Runs up to `limit` enabled ScrapeFlow workflows whose interval has elapsed
// (oldest first) and inserts new El Paso-area businesses into the directory.
// `?dryRun=1` executes everything but writes nothing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Math.min(10, Number(searchParams.get('limit')) || 3))
  const dryRun = searchParams.get('dryRun') === '1'
  try {
    await ensureSeeded()
    const result = await runDueWorkflows({ limit, dryRun })
    const failed = result.ran.filter((r) => r.status === 'FAILED')
    if (failed.length) {
      await reportFailure('cron:scrapeflow', new Error(`${failed.length} workflow run(s) failed`), {
        failed: failed.map((f) => ({ name: f.name, error: f.error })),
      })
    } else {
      await reportSuccess('cron:scrapeflow')
    }
    return NextResponse.json({ ok: true, dryRun, ...result })
  } catch (error) {
    await reportFailure('cron:scrapeflow', error, { limit, dryRun })
    return NextResponse.json({ error: 'ScrapeFlow cron failed' }, { status: 500 })
  }
}
