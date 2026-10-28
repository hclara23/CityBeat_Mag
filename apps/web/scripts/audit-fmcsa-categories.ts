/**
 * READ-ONLY. How many of the unpublished 'Logistics & Freight' rows are not
 * logistics at all?
 *
 * The FMCSA feed registers any company operating trucks as a motor carrier, and
 * the workflow gives every row one blanket Category. That dataset carries no
 * NAICS code, so the NAICS table cannot help here. What the repo does already
 * have is normalize.ts's CATEGORY_KEYWORDS, used by mapCategory when a category
 * is not already an exact DIRECTORY_CATEGORY — so running the business NAME
 * through it is a second opinion on the blanket label.
 *
 * This only reports. Name heuristics are weaker than a federal classifier, so
 * the decision of whether to act on them is a judgement call, not automatic.
 */
import { mapCategory } from '../src/lib/scrapeflow/normalize'

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const auth = { Authorization: `Bearer ${(process.env.GCP_TOKEN || '').trim()}`, 'Content-Type': 'application/json' }

const val = (f: any, k: string): string | null => {
  const x = f?.[k]
  if (!x) return null
  return typeof x.stringValue === 'string' ? x.stringValue.trim() || null : null
}

async function scan() {
  const rows: Array<{ id: string; name: string; phone: string | null; website: string | null }> = []
  let after: string | null = null
  for (;;) {
    const body: any = {
      structuredQuery: {
        from: [{ collectionId: 'directory_listings' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'category' }, op: 'EQUAL', value: { stringValue: 'Logistics & Freight' } } },
              { fieldFilter: { field: { fieldPath: 'is_published' }, op: 'EQUAL', value: { booleanValue: false } } },
            ],
          },
        },
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
    if (!res.ok) throw new Error(JSON.stringify(out).slice(0, 300))
    const batch = (out as any[]).filter((d) => d.document)
    for (const d of batch) {
      const f = d.document.fields
      if (val(f, 'merged_into')) continue
      rows.push({
        id: d.document.name.split('/').pop(),
        name: val(f, 'name') || '',
        phone: val(f, 'phone'),
        website: val(f, 'website'),
      })
    }
    if (batch.length < 1000) break
    after = rows.length ? rows[rows.length - 1].id : null
    if (!after) break
  }
  return rows
}

async function main() {
const rows = (await scan()).filter((r) => r.phone || r.website)
// mapCategory returns an exact DIRECTORY_CATEGORY unchanged, so pass the NAME:
// the keyword table then gets a say, falling back to the blanket label.
const suggestion = new Map<string, Array<string>>()
for (const r of rows) {
  const s = mapCategory(r.name, 'Logistics & Freight')
  if (!suggestion.has(s)) suggestion.set(s, [])
  suggestion.get(s)!.push(r.name)
}

console.log(`unpublished 'Logistics & Freight' rows with a phone or website: ${rows.length}\n`)
console.log('what the name keywords suggest instead:')
for (const [cat, names] of [...suggestion.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const pct = ((names.length / rows.length) * 100).toFixed(0)
  console.log(`\n  ${cat}  —  ${names.length} (${pct}%)`)
  for (const n of names.slice(0, 6)) console.log(`      ${n.slice(0, 46)}`)
}
const kept = (suggestion.get('Logistics & Freight') || []).length
console.log(`\nwould STAY Logistics & Freight : ${kept}`)
console.log(`would MOVE elsewhere           : ${rows.length - kept}`)
}

main().catch((e) => {
  console.error(`Failed: ${e?.message || e}`)
  process.exit(1)
})
