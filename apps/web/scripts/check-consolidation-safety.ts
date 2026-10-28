/**
 * READ-ONLY safety gate for a whole-directory consolidation run.
 *
 *   GCP_TOKEN=... npx tsx scripts/check-consolidation-safety.ts
 *
 * Consolidation UNPUBLISHES the non-canonical members of each same-brand group.
 * It picks the canonical by score (owner_id +100, claim_status != 'unclaimed'
 * +50, then completeness) and skips a group only when MORE THAN ONE member has
 * `owner_id`.
 *
 * That guard is narrower than it looks: the live paying listings carry
 * `claim_status: 'approved'` and NO `owner_id` at all, so the multiple-claimed
 * skip cannot fire for them. They are still protected in practice, because +50
 * dominates every completeness point available (max ~9 plus ratings/1000) — so
 * a claimed member wins canonical and stays published. The one case that would
 * break is TWO protected listings sharing a brand key: neither has owner_id, so
 * the group is not skipped, and one of them gets unpublished.
 *
 * This asserts that case does not exist before anyone applies a merge.
 */
import { normBrandName } from '../src/lib/directory-consolidate'

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const token = (process.env.GCP_TOKEN || '').trim()
if (!token) throw new Error('GCP_TOKEN is not set')
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

type Row = { id: string; name: string; protectedBy: string[]; brand: string }

const val = (f: any, k: string): string | null => {
  const x = f?.[k]
  if (!x) return null
  if (typeof x.stringValue === 'string') return x.stringValue
  if (x.booleanValue != null) return String(x.booleanValue)
  if (x.integerValue != null) return String(x.integerValue)
  return null
}

function protections(f: any): string[] {
  const out: string[] = []
  const claim = val(f, 'claim_status')
  if (claim && claim !== 'unclaimed') out.push(`claim_status=${claim}`)
  for (const k of ['owner_id', 'owner_user_id', 'claimed_by', 'stripe_subscription_id', 'comp_tier', 'sold_by_rep', 'pending_tier']) {
    if (val(f, k)) out.push(k)
  }
  const tier = val(f, 'tier')
  if (tier && tier !== 'basic') out.push(`tier=${tier}`)
  return out
}

async function page(after: string | null): Promise<any[]> {
  const body: any = {
    structuredQuery: {
      from: [{ collectionId: 'directory_listings' }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: 1000,
      select: {
        fields: ['name', 'claim_status', 'owner_id', 'owner_user_id', 'claimed_by', 'tier', 'stripe_subscription_id', 'comp_tier', 'sold_by_rep', 'pending_tier', 'merged_into'].map((f) => ({
          fieldPath: f,
        })),
      },
    },
  }
  if (after) {
    body.structuredQuery.startAt = { values: [{ referenceValue: `projects/${PROJECT}/databases/(default)/documents/directory_listings/${after}` }], before: false }
  }
  const res = await fetch(`${DB}:runQuery`, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  const out = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(out).slice(0, 300))
  return (out as any[]).filter((d) => d.document)
}

async function main() {
  const all: Row[] = []
  let after: string | null = null
  for (;;) {
    const batch = await page(after)
    if (!batch.length) break
    for (const d of batch) {
      const id = d.document.name.split('/').pop()
      const f = d.document.fields || {}
      if (val(f, 'merged_into')) continue // already folded in
      const name = val(f, 'name') || ''
      all.push({ id, name, protectedBy: protections(f), brand: normBrandName(name) })
    }
    if (batch.length < 1000) break
    after = all[all.length - 1].id
  }

  const byBrand = new Map<string, Row[]>()
  for (const r of all) {
    if (!r.brand) continue
    if (!byBrand.has(r.brand)) byBrand.set(r.brand, [])
    byBrand.get(r.brand)!.push(r)
  }

  const protectedRows = all.filter((r) => r.protectedBy.length)
  console.log(`scanned (not already merged) : ${all.length}`)
  console.log(`protected listings            : ${protectedRows.length}`)
  for (const p of protectedRows) {
    const group = byBrand.get(p.brand) || []
    const othersProtected = group.filter((g) => g.id !== p.id && g.protectedBy.length)
    const flag = group.length < 2 ? 'alone in its brand group — untouched' : othersProtected.length ? '*** UNSAFE: shares a brand with another protected listing ***' : `in a group of ${group.length}; wins canonical (+50 beats completeness)`
    console.log(`  ${p.name.slice(0, 32).padEnd(34)} [${p.protectedBy.join(', ')}]`)
    console.log(`     brand="${p.brand}"  ${flag}`)
  }

  const unsafe = protectedRows.filter((p) => {
    const group = byBrand.get(p.brand) || []
    return group.length >= 2 && group.some((g) => g.id !== p.id && g.protectedBy.length)
  })
  console.log(`\nVERDICT: ${unsafe.length === 0 ? 'SAFE — no protected listing can be unpublished as a sibling' : `UNSAFE — ${unsafe.length} protected listing(s) at risk`}`)
  if (unsafe.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`Failed: ${e?.message || e}`)
  process.exit(1)
})
