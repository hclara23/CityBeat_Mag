/**
 * Take FMCSA carriers that are filed under an INDIVIDUAL's own name off the
 * public directory, and record a durable hold so nothing puts them back.
 *
 *   GCP_TOKEN=... npx tsx scripts/hold-fmcsa-individuals.ts             # dry run
 *   GCP_TOKEN=... npx tsx scripts/hold-fmcsa-individuals.ts --apply
 *   GCP_TOKEN=... npx tsx scripts/hold-fmcsa-individuals.ts --restore --apply
 *   GCP_TOKEN=... npx tsx scripts/hold-fmcsa-individuals.ts --restore --only "J & E Truck" --apply
 *
 * WHY. The fmcsa-border-carriers workflow records `Publish: false` with a reason:
 * "a large share of active carriers are sole proprietors filed under a personal
 * name at what is frequently a home address." That decision was overridden by a
 * bulk publish of every row with a phone, made without reading it. The census
 * has no field for a home address, but it does record who the registrant is:
 * when `company_officer_1` is the same person as `legal_name`, the entity IS the
 * individual. `business_org_desc` cannot be used instead — it is 96% blank.
 *
 * THE SIGNAL IS NOISY IN BOTH DIRECTIONS and the dry run says so. It catches
 * personal names, but a few filers type the company name into the officer field,
 * so a handful of company-looking rows are also caught. That is deliberate: this
 * is a privacy action, so it errs toward pulling, and --restore --only puts any
 * single row back by exact name.
 *
 * WHAT MAKES IT STICK. Setting is_published=false alone is not enough: such a row
 * has a name, a category and a phone, so the admin "publish all" route, the
 * bulk-publish scripts and consolidation (which writes is_published:true on every
 * canonical) would each restore it. `publication_hold` is checked by all of them.
 *
 * EXCEPTION, per the owner: real-estate agents are typically individuals and are
 * expected to be listed under their own name, so category 'Real Estate' is never
 * touched. Every FMCSA row is filed under Logistics & Freight, so this excludes
 * nothing today; it is here so the rule is explicit rather than accidental.
 */
import { toCandidate, titleCaseName } from '../src/lib/scrapeflow/normalize'
import type { ExtractedListing } from '../src/lib/scrapeflow/types'
import { holdSignal, HOLD_REVIEWED_NOT_INDIVIDUAL } from '../src/lib/fmcsa-registrant'

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const auth = { Authorization: `Bearer ${(process.env.GCP_TOKEN || '').trim()}`, 'Content-Type': 'application/json' }
const SOCRATA = 'https://data.transportation.gov/resource/az4n-8mr2.json'
const HOLD = 'fmcsa_individual'
const EXEMPT_CATEGORIES = new Set(['Real Estate'])
const WHERE =
  "status_code='A' AND upper(phy_city) in('EL PASO','SOCORRO','HORIZON CITY','VINTON','CLINT','SAN ELIZARIO','CANUTILLO','FABENS','TORNILLO','ANTHONY','LAS CRUCES','SANTA TERESA','SUNLAND PARK','MESILLA')"

const APPLY = process.argv.includes('--apply')
const RESTORE = process.argv.includes('--restore')
// Registry-declared INDIVIDUALs that the officer rule does not catch. Off by
// default: the action the owner approved was the officer rule, and this widens
// it. The dry run always reports how many it would add.
const INCLUDE_REGISTRY = process.argv.includes('--include-registry-individuals')
const onlyIdx = process.argv.indexOf('--only')
const ONLY = onlyIdx >= 0 ? new Set(process.argv[onlyIdx + 1].split(',').map((s) => s.trim().toLowerCase())) : null

if (!(process.env.GCP_TOKEN || '').trim()) throw new Error('GCP_TOKEN is not set')

type Src = Record<string, string | undefined>
async function sourceRows(): Promise<Src[]> {
  const qs = new URLSearchParams({
    $select: 'legal_name,dba_name,phy_street,phy_city,phy_state,phy_zip,phone,company_officer_1,business_org_desc',
    $where: WHERE,
    $limit: '10000',
    $order: 'dot_number',
  })
  const res = await fetch(`${SOCRATA}?${qs}`)
  if (!res.ok) throw new Error(`Socrata ${res.status}`)
  return res.json()
}

/** Rebuild the listing exactly as MAP_JSON_TO_LISTINGS does for this workflow,
 *  so the recomputed `sf:` id IS the stored document id. */
function candidateId(row: Src): string | null {
  const rawName = row.dba_name && row.dba_name.trim() ? row.dba_name : row.legal_name
  if (!rawName) return null
  const listing = {
    name: titleCaseName(rawName),
    category: 'Logistics & Freight',
    address: row.phy_street ? titleCaseName(row.phy_street) : null,
    city: row.phy_city || null,
    state: row.phy_state || null,
    zip: row.phy_zip || null,
    phone: row.phone || null,
    website: null, email: null, description: null, latitude: null, longitude: null, source_url: null,
  } as ExtractedListing
  return toCandidate(listing, { defaultCategory: 'Logistics & Freight', sourceUrl: null })?.google_place_id ?? null
}

const sv = (f: any, k: string): string | null => {
  const x = f?.[k]
  return x && typeof x.stringValue === 'string' ? x.stringValue.trim() || null : null
}

/** Why this row must not be touched, or null. Re-run on the fresh document. */
function protectedReason(f: any): string | null {
  if (sv(f, 'merged_into')) return 'consolidation sibling'
  const category = sv(f, 'category')
  if (category && EXEMPT_CATEGORIES.has(category)) return `exempt category (${category})`
  const claim = sv(f, 'claim_status')
  if (claim && claim !== 'unclaimed') return `claimed (${claim})`
  for (const k of ['owner_id', 'owner_user_id', 'stripe_subscription_id', 'comp_tier', 'pending_tier', 'sold_by_rep']) {
    if (sv(f, k)) return `has ${k}`
  }
  const tier = sv(f, 'tier')
  if (tier && tier !== 'basic') return `tier=${tier}`
  return null
}

async function workflowId(): Promise<string> {
  const res = await fetch(`${DB}:runQuery`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'scrapeflow_workflows' }],
        where: { fieldFilter: { field: { fieldPath: 'template_key' }, op: 'EQUAL', value: { stringValue: 'fmcsa-border-carriers' } } },
        limit: 1,
      },
    }),
  })
  const doc = ((await res.json()) as any[]).find((d) => d.document)?.document
  if (!doc) throw new Error('fmcsa-border-carriers workflow not found')
  return doc.name.split('/').pop()
}

async function listings(wf: string) {
  const out: Array<{ id: string; fields: any }> = []
  let after: string | null = null
  for (;;) {
    const body: any = {
      structuredQuery: {
        from: [{ collectionId: 'directory_listings' }],
        where: { fieldFilter: { field: { fieldPath: 'scrapeflow_workflow_id' }, op: 'EQUAL', value: { stringValue: wf } } },
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
    const j = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 300))
    const batch = (j as any[]).filter((d) => d.document)
    for (const d of batch) out.push({ id: d.document.name.split('/').pop(), fields: d.document.fields || {} })
    if (batch.length < 1000) break
    after = out[out.length - 1].id
  }
  return out
}

async function commit(writes: any[]) {
  const res = await fetch(`${DB}:commit`, { method: 'POST', headers: auth, body: JSON.stringify({ writes }) })
  if (!res.ok) throw new Error(`commit failed: ${JSON.stringify(await res.json()).slice(0, 300)}`)
}

const docName = (id: string) => `projects/${PROJECT}/databases/(default)/documents/directory_listings/${id}`

async function main() {
  const wf = await workflowId()
  const all = await listings(wf)

  if (RESTORE) return restore(all)

  const byId = new Map<string, Src>()
  for (const r of await sourceRows()) {
    const id = candidateId(r)
    if (id) byId.set(id, r)
  }

  const targets: Array<{ id: string; name: string; basis: string }> = []
  const skipped = new Map<string, number>()
  let unmatched = 0
  let alreadyHeld = 0
  let reviewedKept = 0
  let notPublic = 0
  const registryOnly: Array<{ id: string; name: string }> = []

  for (const l of all) {
    // Hold is checked BEFORE publication state. A held row is by definition
    // unpublished, so testing publication first sent every held row into
    // "not public" and made this report "0 already held" with 20 held.
    if (sv(l.fields, 'publication_hold')) { alreadyHeld++; continue }
    if (l.fields.is_published?.booleanValue !== true) { notPublic++; continue }
    const src = byId.get(l.id)
    if (!src) { unmatched++; continue }
    // A recorded review outranks both signals (see holdSignal): a row restored
    // by name stays restored, instead of being re-held by the very rule the
    // restore was correcting.
    const signal = holdSignal({
      officer: src.company_officer_1,
      legalName: src.legal_name,
      businessOrgDesc: src.business_org_desc,
      reviewed: sv(l.fields, 'hold_review'),
    })
    if (!signal) {
      if (sv(l.fields, 'hold_review') === HOLD_REVIEWED_NOT_INDIVIDUAL) reviewedKept++
      continue
    }
    const byOfficer = signal === 'officer' || signal === 'both'
    const byRegistry = signal === 'registry' || signal === 'both'
    const why = protectedReason(l.fields)
    if (why) { skipped.set(why, (skipped.get(why) || 0) + 1); continue }
    if (!byOfficer) {
      registryOnly.push({ id: l.id, name: sv(l.fields, 'name') || '' })
      if (!INCLUDE_REGISTRY) continue
    }
    targets.push({
      id: l.id,
      name: sv(l.fields, 'name') || '',
      basis: byRegistry ? (byOfficer ? 'officer is the entity + registry says INDIVIDUAL' : 'registry says INDIVIDUAL') : 'officer is the entity',
    })
  }

  console.log(`FMCSA listings ${all.length}: ${notPublic} not public, ${alreadyHeld} already held, ${reviewedKept} reviewed as not-individual (left public), ${unmatched} unmatched to source`)
  for (const [why, n] of skipped) console.log(`protected — skipped (${why}): ${n}`)
  console.log(`\nwould take off the public directory: ${targets.length}`)
  console.log(`  of which the registry itself says INDIVIDUAL: ${targets.filter((t) => t.basis.includes('registry')).length}`)
  // Reported every time, because this is the gap in the approved rule: a carrier
  // whose registration literally says INDIVIDUAL but whose officer field differs
  // from the legal name is the clearest individual there is, and the officer
  // rule cannot see it.
  console.log(
    `\nregistry says INDIVIDUAL but the officer rule did NOT match: ${registryOnly.length}` +
      (INCLUDE_REGISTRY
        ? ' (INCLUDED above via --include-registry-individuals)'
        : ' (NOT included — pass --include-registry-individuals to add them)')
  )
  console.log('\n(review the list — the signal also catches a few company-style filings)')
  for (const t of targets) console.log(`  ${t.name.slice(0, 46).padEnd(48)} ${t.basis}`)

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to unpublish ${targets.length}.`)
    return
  }

  const now = new Date().toISOString()
  let written = 0
  const writes: any[] = []
  for (const t of targets) {
    const fresh = await fetch(`https://firestore.googleapis.com/v1/${docName(t.id)}`, { headers: auth }).then((r) => r.json())
    const why = fresh.fields ? protectedReason(fresh.fields) : 'document vanished'
    if (why) { console.log(`  SKIP ${t.name.slice(0, 36)} — ${why}`); continue }
    writes.push({
      update: {
        name: docName(t.id),
        fields: {
          is_published: { booleanValue: false },
          publication_hold: { stringValue: HOLD },
          publication_hold_at: { stringValue: now },
          updated_at: { stringValue: now },
        },
      },
      updateMask: { fieldPaths: ['is_published', 'publication_hold', 'publication_hold_at', 'updated_at'] },
      currentDocument: { exists: true },
    })
  }
  for (let i = 0; i < writes.length; i += 200) {
    await commit(writes.slice(i, i + 200))
    written += Math.min(200, writes.length - i)
    console.log(`  committed ${written}/${writes.length}`)
  }
  console.log(`\nHeld ${written}. Restore all with --restore --apply, or one with --restore --only "<exact name>" --apply.`)
}

async function restore(all: Array<{ id: string; fields: any }>) {
  const held = all.filter((l) => sv(l.fields, 'publication_hold') === HOLD)
  const chosen = held.filter((l) => !ONLY || ONLY.has((sv(l.fields, 'name') || '').toLowerCase()))
  console.log(`rows held as ${HOLD}: ${held.length}; selected to restore: ${chosen.length}`)
  for (const l of chosen) console.log(`  ${(sv(l.fields, 'name') || '').slice(0, 50)}`)
  if (ONLY && chosen.length < ONLY.size) console.log(`  (note: ${ONLY.size - chosen.length} requested name(s) matched no held row — names must match exactly)`)
  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.')
    return
  }
  const now = new Date().toISOString()
  const writes = chosen.map((l) => ({
    update: {
      name: docName(l.id),
      fields: {
        is_published: { booleanValue: true },
        updated_at: { stringValue: now },
        // Only a NAMED restore (--only) is a person ruling on specific rows. A
        // restore-everything is an undo of this script, not a review, so it
        // records nothing and a later hold run may legitimately hold them again.
        ...(ONLY
          ? { hold_review: { stringValue: HOLD_REVIEWED_NOT_INDIVIDUAL }, hold_review_at: { stringValue: now } }
          : {}),
      },
    },
    // publication_hold / publication_hold_at are in the mask but absent from
    // `fields`, which deletes them — so a restored row is not left half-held.
    updateMask: {
      fieldPaths: ['is_published', 'updated_at', 'publication_hold', 'publication_hold_at', ...(ONLY ? ['hold_review', 'hold_review_at'] : [])],
    },
    currentDocument: { exists: true },
  }))
  for (let i = 0; i < writes.length; i += 200) await commit(writes.slice(i, i + 200))
  console.log(`\nRestored ${writes.length}.`)
}

main().catch((e) => {
  console.error(`Failed: ${e?.message || e}`)
  process.exit(1)
})
