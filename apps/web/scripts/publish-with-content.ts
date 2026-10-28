/**
 * Publish unpublished listings that have something a READER can use — a website
 * or a phone number — rather than publishing by category or in bulk.
 *
 *   GCP_TOKEN=... npx tsx scripts/publish-with-content.ts
 *   GCP_TOKEN=... npx tsx scripts/publish-with-content.ts --apply
 *
 * WHY THIS CRITERION AND NOT "RECENTLY ENRICHED".
 *
 * citybeat-enrich-contacts writes exactly one field: `email`. It cannot
 * discover a website or a phone — the Google Places lookup that once did was
 * the licence breach, so a listing with no website is stamped and skipped. And
 * `email`/`contact_email` are both in lib/listing-fields' stripped set, so they
 * never reach a public payload. Enrichment therefore makes a business
 * CONTACTABLE BY SALES and changes its public page not at all; publishing a row
 * because it gained an email would add an indexable page with nothing new on
 * it, and published count is exactly what SEARCH_MAX_RECORDS caps and what the
 * search corpus re-reads every 15 minutes.
 *
 * A website or a phone is different: both render, both give a reader a next
 * step, and both make the page worth the read it costs.
 *
 * Refuses the same things publish-categories does, most importantly a
 * consolidation sibling (`merged_into`) — republishing one silently restores a
 * duplicate that consolidation folded into a multi-location card.
 */
const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const CAP = 25_000

const token = (process.env.GCP_TOKEN || '').trim()
if (!token) throw new Error('GCP_TOKEN is not set')
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const APPLY = process.argv.includes('--apply')

const val = (f: any, k: string): string | null => {
  const x = f?.[k]
  if (!x) return null
  if (typeof x.stringValue === 'string') return x.stringValue.trim() || null
  if (x.booleanValue != null) return String(x.booleanValue)
  if (x.integerValue != null) return String(x.integerValue)
  return null
}

function blockedReason(f: any): string | null {
  if (val(f, 'merged_into')) return 'consolidation sibling (merged_into) — republishing restores a duplicate'
  if (f?.is_published?.booleanValue === true) return 'already published'
  const claim = val(f, 'claim_status')
  if (claim && claim !== 'unclaimed') return `claimed (${claim})`
  for (const k of ['owner_id', 'owner_user_id', 'stripe_subscription_id', 'comp_tier', 'pending_tier']) {
    if (val(f, k)) return `has ${k}`
  }
  const tier = val(f, 'tier')
  if (tier && tier !== 'basic') return `tier=${tier}`
  if (!val(f, 'name')) return 'no name'
  if (!val(f, 'website') && !val(f, 'phone')) return 'no website and no phone — nothing for a reader to act on'
  if (!val(f, 'address')) return 'no address'
  return null
}

async function scanUnpublished() {
  const rows: Array<{ id: string; fields: any }> = []
  let after: string | null = null
  for (;;) {
    const body: any = {
      structuredQuery: {
        from: [{ collectionId: 'directory_listings' }],
        where: { fieldFilter: { field: { fieldPath: 'is_published' }, op: 'EQUAL', value: { booleanValue: false } } },
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

  const rows = await scanUnpublished()
  console.log(`scanned ${rows.length} unpublished listings`)

  const toPublish: Array<{ id: string; name: string; category: string; has: string }> = []
  const blocked = new Map<string, number>()
  const byCategory = new Map<string, number>()
  let withEmailOnly = 0

  for (const r of rows) {
    const reason = blockedReason(r.fields)
    if (reason) {
      blocked.set(reason, (blocked.get(reason) || 0) + 1)
      // How many would a naive "publish what enrichment found" have added, with
      // nothing new on the page? Worth reporting rather than assuming.
      if (reason.startsWith('no website and no phone') && val(r.fields, 'email')) withEmailOnly++
      continue
    }
    const has = [val(r.fields, 'website') ? 'website' : null, val(r.fields, 'phone') ? 'phone' : null]
      .filter(Boolean)
      .join('+')
    const category = val(r.fields, 'category') || '(none)'
    byCategory.set(category, (byCategory.get(category) || 0) + 1)
    toPublish.push({ id: r.id, name: val(r.fields, 'name') || '', category, has })
  }

  console.log('\nskipped:')
  for (const [reason, n] of [...blocked.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${reason}`)
  }
  console.log(`\n  (of the no-website/no-phone rows, ${withEmailOnly} DO have an enriched email —`)
  console.log(`   contactable by sales, but nothing extra on the public page, so not published)`)

  const after = before + toPublish.length
  console.log(`\nwould publish : ${toPublish.length}`)
  for (const [c, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${c.padEnd(24)} ${String(n).padStart(4)}`)
  }
  console.log(`published after: ${after}  (${after > CAP ? '*** OVER CAP ***' : `${CAP - after} headroom left`})`)
  console.log(`added cost     : ~$${((toPublish.length / 1000) * 1.73).toFixed(2)}-$${((toPublish.length / 1000) * 2.5).toFixed(2)}/month`)
  console.log('\nsample:')
  for (const p of toPublish.slice(0, 12)) console.log(`  [${p.category}] ${p.name.slice(0, 40)}  (${p.has})`)

  if (after > CAP) throw new Error('refusing: would exceed SEARCH_MAX_RECORDS and break search')
  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to publish ${toPublish.length}.`)
    return
  }

  const now = new Date().toISOString()
  let written = 0
  for (let i = 0; i < toPublish.length; i += 200) {
    const writes: any[] = []
    for (const p of toPublish.slice(i, i + 200)) {
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
