/**
 * Publish unpublished directory listings in specific categories.
 *
 *   GCP_TOKEN=... npx tsx scripts/publish-categories.ts "Real Estate,Attorneys"
 *   GCP_TOKEN=... npx tsx scripts/publish-categories.ts "Real Estate" --apply
 *
 * WHY SELECTIVE. Published count — not total inventory — is what
 * SEARCH_MAX_RECORDS (25,000) caps and what the search corpus re-reads every
 * 15 minutes per instance, so each published row costs roughly $1.73-$2.50 per
 * 1,000 per month in Firestore reads (measured 2026-10-28, nam5 multi-region at
 * $0.06/100k). Publishing the whole 19,976-row unpublished backlog would roughly
 * triple the bill for pages that carry only a name and an address.
 *
 * WHAT IT REFUSES TO PUBLISH, and the one that matters most:
 *
 *   merged_into — a consolidation sibling. Those were deliberately unpublished
 *   so that 22 Taco Bell cards could become one card with 22 locations.
 *   Republishing them silently undoes the merge and restores every duplicate.
 *   This is the single most destructive thing this script could do, so it is
 *   checked first and counted separately in the report.
 *
 * It also skips anything already published, anything claimed/owned/paid (their
 * visibility is the owner's business, not a bulk job's), and re-checks every
 * row against its freshly read document immediately before the write. Only
 * `is_published` and `updated_at` are ever written.
 */
import { DIRECTORY_CATEGORIES } from '../src/lib/categories'

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const CAP = 25_000

const token = (process.env.GCP_TOKEN || '').trim()
if (!token) throw new Error('GCP_TOKEN is not set')
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

const APPLY = process.argv.includes('--apply')
const requested = (process.argv[2] || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean)
if (!requested.length) throw new Error('pass categories, e.g. "Real Estate,Attorneys"')

const unknown = requested.filter((c) => !(DIRECTORY_CATEGORIES as readonly string[]).includes(c))
if (unknown.length) throw new Error(`not a DIRECTORY_CATEGORY: ${unknown.join(', ')}`)

const val = (f: any, k: string): string | null => {
  const x = f?.[k]
  if (!x) return null
  if (typeof x.stringValue === 'string') return x.stringValue
  if (x.booleanValue != null) return String(x.booleanValue)
  if (x.integerValue != null) return String(x.integerValue)
  return null
}

/** null when safe to publish, otherwise why not. Order matters: merged_into first. */
function blockedReason(f: any): string | null {
  if (val(f, 'merged_into')) return 'consolidation sibling (merged_into) — republishing restores a duplicate'
  // A hold is a recorded decision not to show this listing (e.g. an FMCSA
  // carrier filed under an individual's own name). It outranks every content
  // check below: such a row has a phone and an address, so it would otherwise
  // look like exactly the kind of listing this script exists to publish.
  if (val(f, 'publication_hold')) return `publication hold (${val(f, 'publication_hold')})`
  if (f?.is_published?.booleanValue === true) return 'already published'
  const claim = val(f, 'claim_status')
  if (claim && claim !== 'unclaimed') return `claimed (${claim})`
  for (const k of ['owner_id', 'owner_user_id', 'stripe_subscription_id', 'comp_tier', 'pending_tier']) {
    if (val(f, k)) return `has ${k}`
  }
  const tier = val(f, 'tier')
  if (tier && tier !== 'basic') return `tier=${tier}`
  if (!val(f, 'name')) return 'no name'
  if (!val(f, 'address')) return 'no address — nothing to show on a page'
  return null
}

async function queryCategory(category: string) {
  const rows: Array<{ id: string; fields: any }> = []
  let after: string | null = null
  for (;;) {
    const body: any = {
      structuredQuery: {
        from: [{ collectionId: 'directory_listings' }],
        where: { fieldFilter: { field: { fieldPath: 'category' }, op: 'EQUAL', value: { stringValue: category } } },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        limit: 1000,
      },
    }
    if (after) {
      body.structuredQuery.startAt = {
        values: [{ referenceValue: `projects/${PROJECT}/databases/(default)/documents/directory_listings/${after}` }],
        before: false,
      }
    }
    const res = await fetch(`${DB}:runQuery`, { method: 'POST', headers: auth, body: JSON.stringify(body) })
    const out = await res.json()
    if (!res.ok) throw new Error(`query failed: ${JSON.stringify(out).slice(0, 300)}`)
    const batch = (out as any[]).filter((d) => d.document)
    for (const d of batch) rows.push({ id: d.document.name.split('/').pop(), fields: d.document.fields || {} })
    if (batch.length < 1000) break
    after = rows[rows.length - 1].id
  }
  return rows
}

async function publishedCount() {
  const res = await fetch(`${DB}:runAggregationQuery`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: 'directory_listings' }],
          where: { fieldFilter: { field: { fieldPath: 'is_published' }, op: 'EQUAL', value: { booleanValue: true } } },
        },
        aggregations: [{ alias: 'n', count: {} }],
      },
    }),
  })
  const out = await res.json()
  for (const r of Array.isArray(out) ? out : [out]) {
    if (r?.result?.aggregateFields?.n?.integerValue != null) return Number(r.result.aggregateFields.n.integerValue)
  }
  return -1
}

async function main() {
  const before = await publishedCount()
  console.log(`published now: ${before}   cap: ${CAP}   headroom: ${CAP - before}\n`)

  const toPublish: Array<{ id: string; name: string; category: string }> = []
  const blocked = new Map<string, number>()
  let withContact = 0

  for (const category of requested) {
    const rows = await queryCategory(category)
    let eligible = 0
    for (const r of rows) {
      const reason = blockedReason(r.fields)
      if (reason) {
        blocked.set(reason, (blocked.get(reason) || 0) + 1)
        continue
      }
      eligible++
      if (val(r.fields, 'phone') || val(r.fields, 'website')) withContact++
      toPublish.push({ id: r.id, name: val(r.fields, 'name') || '', category })
    }
    console.log(`${category.padEnd(24)} ${String(rows.length).padStart(5)} total   ${String(eligible).padStart(4)} publishable`)
  }

  console.log('\nskipped:')
  for (const [reason, n] of [...blocked.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${reason}`)
  }

  const after = before + toPublish.length
  const lo = (toPublish.length / 1000) * 1.73
  const hi = (toPublish.length / 1000) * 2.5
  console.log(`\nwould publish : ${toPublish.length}`)
  console.log(`  of which with a phone or website: ${withContact}`)
  console.log(`published after: ${after}  (${after > CAP ? '*** OVER THE CAP — search would fail closed ***' : `${CAP - after} headroom left`})`)
  console.log(`added cost     : ~$${lo.toFixed(2)}-$${hi.toFixed(2)}/month`)
  console.log('\nsample:')
  for (const p of toPublish.slice(0, 10)) console.log(`  [${p.category}] ${p.name.slice(0, 48)}`)

  if (after > CAP) throw new Error('refusing: this would exceed SEARCH_MAX_RECORDS and break search')
  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to publish ${toPublish.length}.`)
    return
  }

  const now = new Date().toISOString()
  let written = 0
  for (let i = 0; i < toPublish.length; i += 200) {
    const slice = toPublish.slice(i, i + 200)
    const writes: any[] = []
    for (const p of slice) {
      const fresh = await fetch(`${DB}/directory_listings/${p.id}`, { headers: auth }).then((r) => r.json())
      const reason = fresh.fields ? blockedReason(fresh.fields) : 'document vanished'
      if (reason) {
        console.log(`  SKIP ${p.name.slice(0, 36)} — ${reason}`)
        continue
      }
      writes.push({
        update: {
          name: `projects/${PROJECT}/databases/(default)/documents/directory_listings/${p.id}`,
          fields: { is_published: { booleanValue: true }, updated_at: { stringValue: now } },
        },
        updateMask: { fieldPaths: ['is_published', 'updated_at'] },
        currentDocument: { exists: true },
      })
    }
    if (writes.length) {
      const res = await fetch(`${DB}:commit`, { method: 'POST', headers: auth, body: JSON.stringify({ writes }) })
      if (!res.ok) throw new Error(`commit failed: ${JSON.stringify(await res.json()).slice(0, 300)}`)
      written += writes.length
      console.log(`  committed ${written}/${toPublish.length}`)
    }
  }
  console.log(`\nPublished ${written}. published count: ${before} -> ${await publishedCount()}`)
}

main().catch((e) => {
  console.error(`\nFailed: ${e?.message || e}`)
  process.exit(1)
})
