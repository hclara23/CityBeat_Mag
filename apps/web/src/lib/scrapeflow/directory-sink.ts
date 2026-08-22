// "Deliver to CityBeat directory" sink. Mirrors the insert-only contract of
// packages/lib/src/directory/crawlee-ingest.ts#writeCandidates: NEVER merge
// over existing docs (a nightly upsert would reset tier/claim_status on paying
// customers). Scraped rows get a stable `sf:<hash>` id and are additionally
// deduped against existing listings by exact name (+ street/phone agreement).

import { adminDb } from '@citybeat/lib/firebase/admin'
import type { ExtractedListing, RunSummary } from './types'
import { inRegion, looksLikeSameBusiness, toCandidate, type DirectoryCandidate } from './normalize'

export * from './normalize'

export async function deliverToDirectory(
  listings: ExtractedListing[],
  opts: {
    defaultCategory: string
    regionFilter: boolean
    publish: boolean
    dryRun: boolean
    sourceUrl: string | null
    workflowId: string | null
    log?: (level: 'info' | 'warn' | 'error', message: string) => void
  }
): Promise<RunSummary & { inserted_ids: string[]; sample: DirectoryCandidate[] }> {
  const log = opts.log || (() => {})
  const summary = { candidates: 0, inserted: 0, skipped_existing: 0, skipped_invalid: 0, pages_crawled: 0 }
  const inserted_ids: string[] = []
  const seen = new Set<string>()
  const candidates: DirectoryCandidate[] = []

  for (const listing of listings) {
    if (opts.regionFilter && !inRegion(listing)) {
      summary.skipped_invalid++
      continue
    }
    const candidate = toCandidate(listing, { defaultCategory: opts.defaultCategory, sourceUrl: opts.sourceUrl })
    if (!candidate) {
      summary.skipped_invalid++
      continue
    }
    if (seen.has(candidate.google_place_id)) continue
    seen.add(candidate.google_place_id)
    candidates.push(candidate)
  }
  summary.candidates = candidates.length
  if (!candidates.length) return { ...summary, inserted_ids, sample: [] }

  // 1) id existence check (batched getAll).
  const existingIds = new Set<string>()
  for (let i = 0; i < candidates.length; i += 300) {
    const refs = candidates.slice(i, i + 300).map((c) => adminDb.collection('directory_listings').doc(c.google_place_id))
    const snaps = await adminDb.getAll(...refs)
    for (const s of snaps) if (s.exists) existingIds.add(s.id)
  }

  // 2) same-name check against OSM/other-source rows.
  const toInsert: DirectoryCandidate[] = []
  for (const c of candidates) {
    if (existingIds.has(c.google_place_id)) {
      summary.skipped_existing++
      continue
    }
    const sameName = await adminDb.collection('directory_listings').where('name', '==', c.name).limit(10).get()
    const dup = sameName.docs.some((d) => looksLikeSameBusiness(c, d.data() as any))
    if (dup) {
      summary.skipped_existing++
      continue
    }
    toInsert.push(c)
  }

  if (opts.dryRun) {
    log('info', `Dry run: ${toInsert.length} new listings would be inserted (${summary.skipped_existing} already exist).`)
    return { ...summary, inserted: 0, inserted_ids: toInsert.map((c) => c.google_place_id), sample: toInsert.slice(0, 25) }
  }

  const now = new Date().toISOString()
  let batch = adminDb.batch()
  let ops = 0
  for (const c of toInsert) {
    batch.set(adminDb.collection('directory_listings').doc(c.google_place_id), {
      ...c,
      tier: 'basic',
      claim_status: 'unclaimed',
      is_published: opts.publish,
      rating: null,
      user_ratings_total: null,
      scrapeflow_workflow_id: opts.workflowId,
      created_at: now,
      updated_at: now,
    })
    ops++
    summary.inserted++
    inserted_ids.push(c.google_place_id)
    if (ops >= 450) {
      await batch.commit()
      batch = adminDb.batch()
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()
  log('info', `Inserted ${summary.inserted} listings (${summary.skipped_existing} existed, ${summary.skipped_invalid} out of region/invalid).`)
  return { ...summary, inserted_ids, sample: toInsert.slice(0, 25) }
}
