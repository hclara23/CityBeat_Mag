import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import {
  daysAgoKey,
  statsDocId,
  statsToCsv,
  summarizeListingStats,
  totalsForRange,
  dayKey,
  type DailyStatRow,
} from '@/lib/listing-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Owner analytics, entitlement-tiered:
// - Basic (all tiers): rolling 30-day headline totals.
// - fullAnalytics: daily series + prior-window comparison.
// - analyticsExport (+ ?format=csv): CSV download (formula-injection safe).
// Protected data never leaks to non-entitled callers — the response is shaped
// server-side by the resolved entitlements, not by hiding UI.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  const isStaff = hasEditorAccess(profile)

  const doc = await adminDb.collection('directory_listings').doc(id).get()
  if (!doc.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  const listing = doc.data() as Record<string, any>
  const entitlements = resolveEntitlements(listing)
  const { canManage } = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff,
    managerAllowance: entitlements.additionalManagers,
  })
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const fullAccess = isStaff || entitlements.fullAnalytics
  const canExport = isStaff || entitlements.analyticsExport

  const now = new Date()
  // 60 days covers the 30-day window plus its comparison window.
  const days: string[] = []
  for (let i = 59; i >= 0; i--) days.push(daysAgoKey(now, i))
  const refs = days.map((day) => adminDb.collection('listing_stats').doc(statsDocId(id, day)))
  const snaps = await adminDb.getAll(...refs)
  const rows: DailyStatRow[] = snaps
    .filter((s) => s.exists)
    .map((s) => s.data() as DailyStatRow)

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv') {
    if (!canExport) {
      return NextResponse.json(
        { error: 'CSV export is included with Premium.', code: 'not_entitled' },
        { status: 403 }
      )
    }
    return new NextResponse(statsToCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="citybeat-listing-${id}-stats.csv"`,
      },
    })
  }

  if (!fullAccess) {
    // Basic: headline 30-day totals only — no series, no comparisons.
    const current = totalsForRange(rows, daysAgoKey(now, 29), dayKey(now))
    return NextResponse.json({ window_days: 30, current, full: false })
  }

  const summary = summarizeListingStats(rows, now, 30)
  return NextResponse.json({ ...summary, full: true })
}
