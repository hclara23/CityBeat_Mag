import { NextRequest, NextResponse } from 'next/server'
import { runDirectoryIngest } from '@citybeat/lib/directory/ingest'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// The full sales-inventory sweep. 'Retail' and 'Professional Services' are
// deliberately excluded — their OSM selectors (bare shop=* / office=*) are too
// noisy and would flood the queue with low-fit targets.
const DEFAULT_CATEGORIES = [
  'Restaurant',
  'Auto Dealer',
  'Cafe',
  'Bar',
  'Health',
  'Fitness',
  'Beauty',
  'Auto Repair',
  'Home Services',
  'Entertainment',
]

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
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
    const result = await runDirectoryIngest({
      write: true,
      limit,
      categories,
    })

    await reportSuccess('cron:directory-ingest')
    return NextResponse.json({
      ok: true,
      categories,
      prepared: result.candidates.length,
      inserted: result.inserted,
    })
  } catch (error) {
    await reportFailure('cron:directory-ingest', error, { categories, limit })
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}
