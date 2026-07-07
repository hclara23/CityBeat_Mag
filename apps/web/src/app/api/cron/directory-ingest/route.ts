import { NextRequest, NextResponse } from 'next/server'
import { runDirectoryIngest } from '@citybeat/lib/directory/ingest'
import { reportFailure, reportSuccess } from '@/lib/alerts'

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
