import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { computeCategoryBenchmark, type BenchmarkCohortListing } from '@/lib/benchmarks'
import { daysAgoKey, dayKey, totalsForRange, type DailyStatRow } from '@/lib/listing-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Category/competitor benchmarks — a Featured entitlement. Returns anonymized
// aggregates only, and only when the cohort is large enough (enforced by
// computeCategoryBenchmark) so no single competitor is identifiable.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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
  if (!isStaff && !entitlements.categoryBenchmarking) {
    return NextResponse.json({ error: 'Benchmarks are a Featured feature.', code: 'not_entitled' }, { status: 403 })
  }

  const category = String(listing.category || '')
  if (!category) return NextResponse.json({ available: false, reason: 'no_category', category: '' })

  // Cohort: published listings in the same category.
  const cohortSnap = await adminDb
    .collection('directory_listings')
    .where('category', '==', category)
    .where('is_published', '==', true)
    .limit(500)
    .get()

  const now = new Date()
  const curStart = daysAgoKey(now, 29)
  const curEnd = dayKey(now)

  // 30-day views per cohort listing from listing_stats.
  const viewsById = new Map<string, number>()
  const statsSnap = await adminDb.collection('listing_stats').where('day', '>=', curStart).get()
  const rowsById = new Map<string, DailyStatRow[]>()
  for (const s of statsSnap.docs) {
    const x = s.data() as DailyStatRow & { listing_id?: string }
    if (!x.listing_id) continue
    const arr = rowsById.get(x.listing_id) || []
    arr.push(x)
    rowsById.set(x.listing_id, arr)
  }
  for (const [lid, rows] of rowsById) {
    viewsById.set(lid, totalsForRange(rows, curStart, curEnd).view)
  }

  const listings: BenchmarkCohortListing[] = cohortSnap.docs.map((d) => {
    const l = d.data() as any
    return {
      id: d.id,
      rating: typeof l.rating === 'number' ? l.rating : null,
      reviews: typeof l.user_ratings_total === 'number' ? l.user_ratings_total : 0,
      views30: viewsById.get(d.id) || 0,
    }
  })

  const result = computeCategoryBenchmark({ category, listingId: id, listings })
  return NextResponse.json(result)
}
