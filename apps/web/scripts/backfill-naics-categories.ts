/**
 * Re-categorise the Texas Comptroller listings that were imported under one
 * blanket category.
 *
 *   npx tsx scripts/backfill-naics-categories.ts            # dry run
 *   npx tsx scripts/backfill-naics-categories.ts --apply
 *   npx tsx scripts/backfill-naics-categories.ts --limit 50 --apply
 *
 * Run from apps/web with GCP_TOKEN set:
 *   $env:GCP_TOKEN = (gcloud auth print-access-token --account <authorized>)
 *
 * WHY
 *
 * The Comptroller feed set `Category: 'Professional Services'` for every row,
 * so ~406 El Paso businesses — donut shops, a golf course, a wireless dealer —
 * share one category while the dataset's own `outlet_naics_code` went unread.
 * The mapper now categorises per row; this fixes the rows already written.
 *
 * HOW THE MATCH IS EXACT
 *
 * The doc id is `sf:` + sha1 of a key derived from the name and street, so it
 * is recomputable from the source row. Rather than reimplement that hashing —
 * where any drift would silently match the wrong listing, or none — this script
 * imports `toCandidate`, the SAME function the ingest pipeline calls, and
 * rebuilds each row the way the mapper does. If the pipeline's id scheme ever
 * changes, this script changes with it instead of quietly going stale.
 *
 * WHAT IT REFUSES TO TOUCH
 *
 * Only `category` and `updated_at` are ever written, and only on a row that is
 * still an unclaimed, unowned, unpaid, non-rep-sold Basic listing whose current
 * category is exactly the blanket default. Anything a customer paid for, any
 * claim at any stage, and anything a human has already re-categorised is left
 * alone — the protections are re-checked against the freshly read document
 * immediately before the write is queued.
 */
import { createHash } from 'node:crypto'
import { naicsCategory } from '../src/lib/scrapeflow/naics'
import { toCandidate, titleCaseName } from '../src/lib/scrapeflow/normalize'
import type { ExtractedListing } from '../src/lib/scrapeflow/types'

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const WORKFLOW_ID = '2BObA6FMKHSS4NUc9WXr' // TX Comptroller — new sales-tax permits
const BLANKET_CATEGORY = 'Professional Services'
const SOCRATA = 'https://data.texas.gov/resource/jrea-zgmq.json'
const WHERE =
  "outlet_county_code='071' AND outlet_permit_issue_date IS NOT NULL" +
  " AND outlet_naics_code NOT IN ('454110','454390','611110')"

// Mirrors lib/places-cleanup.ts: a named allowlist on top of the structural
// protections, so a specific business can be pinned out of any bulk operation.
const NEVER_TOUCH_NAMES = new Set(['varsity roofing'])

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || Infinity : Infinity

const token = (process.env.GCP_TOKEN || '').trim()
if (!token) throw new Error('GCP_TOKEN is not set — see the header comment')
const auth = { Authorization: `Bearer ${token}` }

const val = (f: any, k: string): string | null => {
  const x = f?.[k]
  if (!x) return null
  if (typeof x.stringValue === 'string') return x.stringValue
  if (x.integerValue != null) return String(x.integerValue)
  if (x.booleanValue != null) return String(x.booleanValue)
  return null
}

/** Why this listing must not be written to, or null when it is safe. */
function protectedReason(f: any): string | null {
  const name = (val(f, 'name') || '').trim().toLowerCase()
  if (NEVER_TOUCH_NAMES.has(name)) return 'allowlisted by name'
  const claim = val(f, 'claim_status')
  if (claim && claim !== 'unclaimed') return `claim_status=${claim}`
  for (const k of ['owner_user_id', 'owner_uid', 'claimed_by', 'claimed_at']) {
    if (val(f, k)) return `has ${k}`
  }
  const tier = val(f, 'tier')
  if (tier && tier !== 'basic') return `tier=${tier}`
  for (const k of ['stripe_subscription_id', 'subscription_status', 'comp_tier', 'sold_by_rep', 'pending_tier']) {
    if (val(f, k)) return `has ${k}`
  }
  const current = val(f, 'category')
  if (current !== BLANKET_CATEGORY) return `category already ${current} (human-curated or already backfilled)`
  return null
}

async function socrataRows() {
  const url =
    `${SOCRATA}?$select=` +
    encodeURIComponent('outlet_name, outlet_address, outlet_city, outlet_state, outlet_zip_code, outlet_naics_code') +
    '&$limit=50000&$where=' +
    encodeURIComponent(WHERE)
  const rows = await fetch(url).then((r) => r.json())
  if (!Array.isArray(rows)) throw new Error(`Socrata did not return an array: ${JSON.stringify(rows).slice(0, 200)}`)
  return rows as Array<Record<string, string>>
}

/** id → category, built through the real pipeline so ids cannot drift. */
function categoryByDocId(rows: Array<Record<string, string>>) {
  const byId = new Map<string, { category: string; naics: string; name: string }>()
  let unmapped = 0
  for (const row of rows) {
    const naics = row.outlet_naics_code || ''
    const category = naicsCategory(naics)
    if (!category) {
      unmapped++
      continue // no confident mapping: the blanket default stays, as designed
    }
    // Exactly how mapJsonToListings builds a listing for this workflow:
    // Title case names = true, field map name/address/city/state/zip, no phone.
    const listing: ExtractedListing = {
      name: titleCaseName(row.outlet_name || ''),
      category,
      address: row.outlet_address ? titleCaseName(row.outlet_address) : null,
      city: row.outlet_city || null,
      state: row.outlet_state || null,
      zip: row.outlet_zip_code || null,
      phone: null,
      website: null,
      email: null,
      description: null,
      latitude: null,
      longitude: null,
      source_url: null,
    } as ExtractedListing
    const candidate = toCandidate(listing, { defaultCategory: BLANKET_CATEGORY, sourceUrl: null })
    if (!candidate) continue
    byId.set(candidate.google_place_id, { category: candidate.category, naics, name: candidate.name })
  }
  return { byId, unmapped }
}

async function comptrollerListings() {
  const docs: Array<{ id: string; fields: any }> = []
  let pageToken: string | undefined
  do {
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'directory_listings' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'scrapeflow_workflow_id' },
            op: 'EQUAL',
            value: { stringValue: WORKFLOW_ID },
          },
        },
        limit: 1000,
        ...(pageToken ? { offset: docs.length } : {}),
      },
    }
    const res = await fetch(`${DB}:runQuery`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const out = await res.json()
    if (!res.ok) throw new Error(`runQuery failed: ${JSON.stringify(out).slice(0, 300)}`)
    const batch = (out as any[]).filter((d) => d.document)
    for (const d of batch) docs.push({ id: d.document.name.split('/').pop(), fields: d.document.fields })
    pageToken = batch.length === 1000 ? 'more' : undefined
  } while (pageToken)
  return docs
}

async function commit(writes: any[]) {
  const res = await fetch(`${DB}:commit`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  const out = await res.json()
  if (!res.ok) throw new Error(`commit failed: ${JSON.stringify(out).slice(0, 400)}`)
}

async function main() {
  console.log('Fetching the Comptroller dataset…')
  const rows = await socrataRows()
  const { byId, unmapped } = categoryByDocId(rows)
  console.log(`  ${rows.length} source rows, ${byId.size} recomputed ids, ${unmapped} with no confident NAICS mapping`)

  console.log('Reading the listings this workflow created…')
  const listings = await comptrollerListings()
  console.log(`  ${listings.length} listings carry scrapeflow_workflow_id=${WORKFLOW_ID}`)

  const planned: Array<{ id: string; name: string; from: string; to: string; naics: string }> = []
  const skipped = new Map<string, number>()
  let unmatched = 0

  for (const doc of listings) {
    const reason = protectedReason(doc.fields)
    if (reason) {
      skipped.set(reason.replace(/category already .*/, 'category already set'), (skipped.get(reason.replace(/category already .*/, 'category already set')) || 0) + 1)
      continue
    }
    const hit = byId.get(doc.id)
    if (!hit) {
      unmatched++
      continue
    }
    if (hit.category === BLANKET_CATEGORY) continue // NAICS agrees with the default
    planned.push({ id: doc.id, name: val(doc.fields, 'name') || hit.name, from: BLANKET_CATEGORY, to: hit.category, naics: hit.naics })
  }

  const byTarget = new Map<string, number>()
  for (const p of planned) byTarget.set(p.to, (byTarget.get(p.to) || 0) + 1)

  console.log('\n── plan ───────────────────────────────────────────────')
  console.log(`would re-categorise : ${planned.length}`)
  console.log(`left as-is (NAICS agrees or no mapping) : ${listings.length - planned.length - unmatched - [...skipped.values()].reduce((a, b) => a + b, 0)}`)
  console.log(`not matched to a source row : ${unmatched}`)
  for (const [reason, n] of skipped) console.log(`PROTECTED — skipped (${reason}): ${n}`)
  console.log('\nnew category distribution:')
  for (const [category, n] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(24)} ${String(n).padStart(4)}`)
  }
  console.log('\nsample:')
  for (const p of planned.slice(0, 15)) {
    console.log(`  ${p.name.slice(0, 40).padEnd(42)} ${p.from} → ${p.to}  (NAICS ${p.naics})`)
  }

  const toWrite = planned.slice(0, LIMIT === Infinity ? planned.length : LIMIT)
  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to update ${toWrite.length}.`)
    return
  }

  console.log(`\nApplying to ${toWrite.length}…`)
  const now = new Date().toISOString()
  let written = 0
  for (let i = 0; i < toWrite.length; i += 200) {
    const slice = toWrite.slice(i, i + 200)
    // Re-read and re-check immediately before writing, so a claim or purchase
    // that landed during this run cannot be overwritten by a stale decision.
    const writes: any[] = []
    for (const p of slice) {
      const fresh = await fetch(`${DB}/directory_listings/${p.id}`, { headers: auth }).then((r) => r.json())
      const reason = fresh.fields ? protectedReason(fresh.fields) : 'document vanished'
      if (reason) {
        console.log(`  SKIP ${p.name.slice(0, 36)} — ${reason}`)
        continue
      }
      writes.push({
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/directory_listings/${p.id}`,
          fields: { category: { stringValue: p.to }, updated_at: { stringValue: now } },
        },
        updateMask: { fieldPaths: ['category', 'updated_at'] },
        currentDocument: { exists: true },
      })
    }
    if (writes.length) {
      await commit(writes)
      written += writes.length
      console.log(`  committed ${written}/${toWrite.length}`)
    }
  }
  console.log(`\nDone. ${written} listings re-categorised.`)
}

main().catch((error) => {
  console.error(`\nFailed: ${error?.message || error}`)
  process.exit(1)
})
