import { NextRequest, NextResponse } from 'next/server'
import { runDirectoryIngest } from '@citybeat/lib/directory/ingest'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// High-value B2B / professional-services sweep. These verticals routinely pay
// for lead-gen and directory/marketing placement, so they convert far better
// than consumer businesses. The earlier consumer categories (Restaurant, Cafe,
// etc.) still exist in CATEGORY_QUERIES and can be re-targeted per-request via
// ?categories=, but are no longer the nightly focus. Existing inventory is
// untouched (ingest is insert-only).
const DEFAULT_CATEGORIES = [
  'Real Estate',
  'Attorneys',
  'Title & Notary',
  'Insurance',
  'Financial',
  'Marketing',
  'Web Development',
]

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    // A rejected BEARER token is our own scheduler running against a rotated or
    // mistyped CRON_SECRET. That silences EVERY job at once, before any of their
    // try/catch blocks can report anything — the whole automation engine stops and
    // the only symptom is that nothing happens. Report it from the 401 itself.
    await reportCronAuthRejected('cron:directory-ingest', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Number(searchParams.get('limit') || process.env.DIRECTORY_INGEST_LIMIT || 500))
  const categories = (searchParams.get('categories') || DEFAULT_CATEGORIES.join(','))
    .split(',')
    .map((category) => category.trim())
    .filter(Boolean)

  try {
    // Crawls OSM/Overpass and upserts into Firestore `directory_listings`.
    // Budgeted: see packages/lib/src/directory/ingest-schedule.ts. One run
    // deliberately sweeps a rotating slice of the categories rather than all of
    // them — the unbudgeted version could not finish inside Cloud Run's 300s
    // request timeout and discarded everything it had fetched when it overran.
    const result = await runDirectoryIngest({
      write: true,
      limit,
      categories,
    })

    // Liveness is about whether the job RAN, which it did. Content problems are
    // alerted separately below, so a bad night cannot masquerade as a dead cron
    // and a dead cron cannot hide behind a bad night.
    await reportSuccess('cron:directory-ingest')

    if (result.failed.length > 0) {
      await reportFailure(
        'cron:directory-ingest',
        new Error(
          `Overpass failed for ${result.failed.length} categor${result.failed.length === 1 ? 'y' : 'ies'}: ` +
            result.failed.map((f) => `${f.category} (${f.reason})`).join('; ')
        ),
        { swept: result.swept, skipped: result.skipped, limit },
        { skipHealth: true }
      ).catch(() => {})
    }

    const body = {
      ok: result.swept.length > 0,
      requested: categories,
      swept: result.swept,
      skipped: result.skipped,
      failed: result.failed,
      budget_exhausted: result.budgetExhausted,
      prepared: result.candidates.length,
      inserted: result.inserted,
    }

    // Every attempted category failed: nothing was ingested and nothing will be
    // until someone looks. Answer 500 so the scheduler's own status code goes
    // red — that status code is the ONLY signal that surfaced the week-long
    // outage this route just came out of, and it must keep working.
    if (result.swept.length === 0 && result.failed.length > 0) {
      return NextResponse.json({ ...body, error: 'Every category failed' }, { status: 500 })
    }

    return NextResponse.json(body)
  } catch (error) {
    await reportFailure('cron:directory-ingest', error, { categories, limit })
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}
