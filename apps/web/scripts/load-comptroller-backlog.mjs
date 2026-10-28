// Load the Texas Comptroller BACK CATALOGUE into the directory, UNPUBLISHED.
//
//   node load-backlog.mjs                 # plan + one dry-run slice
//   node load-backlog.mjs --apply         # load everything
//   node load-backlog.mjs --apply --max 3 # load only 3 slices
//
// Needs GCP_TOKEN (gcloud access token) and CRON_SECRET.
//
// WHY IT DRIVES THE DEPLOYED APP instead of writing Firestore directly:
// deliverToDirectory owns the dedupe (name + street/phone against existing
// rows), the El Paso/Dona Ana region filter, the insert-only guarantee that
// never touches a claimed or paid listing, and the multi-location
// consolidation. Reimplementing any of that here would be a second
// implementation of the money-adjacent rules, free to drift. So this creates a
// workflow whose only difference from the live daily one is pagination and
// Publish=false, then calls the real cron route once per page.
//
// WHY UNPUBLISHED: api/directory/route.ts builds the search corpus from
// `where('is_published','==',true)` and createDirectoryIndexCache THROWS past
// SEARCH_MAX_RECORDS (25,000) — it fails closed, so search breaks outright
// rather than degrading. 9,454 are published today; up to 19,286 more would
// reach 28,740. Unpublished rows are invisible to that loader, so the index,
// its per-rebuild read cost and the SEO surface are all untouched, and the rows
// can be published later in controlled batches.

const PROJECT = 'kerstenblueprint'
const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const APP = 'https://citybeat-web-aa3zf3nfza-uc.a.run.app'
const COLL = 'scrapeflow_workflows'
const KEY = 'comptroller-el-paso-BACKLOG'
const PAGE = Number(process.env.PAGE_SIZE || 800)
const APPLY = process.argv.includes('--apply')
const maxArg = process.argv.indexOf('--max')
const MAX_SLICES = maxArg >= 0 ? Number(process.argv[maxArg + 1]) || 1 : Infinity

const token = (process.env.GCP_TOKEN || '').trim()
const cronSecret = (process.env.CRON_SECRET || '').trim()
if (!token) throw new Error('GCP_TOKEN is not set')
if (!cronSecret) throw new Error('CRON_SECRET is not set')
const auth = { Authorization: `Bearer ${token}` }
const jsonAuth = { ...auth, 'Content-Type': 'application/json' }

// Same NAICS exclusions as the daily workflow (home-based online/direct sellers
// and public schools are not storefronts). Deterministic multi-column order:
// permit issue date has thousands of ties, so paging on it with $offset would
// skip and duplicate rows. taxpayer_number + outlet_number is unique.
const WHERE = "outlet_county_code='071' AND outlet_naics_code NOT IN ('454110','454390','611110')"
const ORDER = 'taxpayer_number, outlet_number'
const sourceUrl = (offset) =>
  'https://data.texas.gov/resource/jrea-zgmq.json?$order=' +
  encodeURIComponent(ORDER) +
  `&$limit=${PAGE}&$offset=${offset}&$where=` +
  encodeURIComponent(WHERE)

const FIELD_MAP = JSON.stringify({
  name: 'outlet_name',
  address: 'outlet_address',
  city: 'outlet_city',
  state: 'outlet_state',
  zip: 'outlet_zip_code',
})

const definition = (offset) => ({
  mapValue: {
    fields: {
      nodes: {
        arrayValue: {
          values: [
            node('fetch', 'FETCH_JSON', { URL: sourceUrl(offset), 'Max items': String(PAGE) }),
            node('map', 'MAP_JSON_TO_LISTINGS', {
              JSON: '{{fetch.JSON}}',
              'Field map': FIELD_MAP,
              'NAICS field': 'outlet_naics_code',
              Category: 'Professional Services',
              'Title case names': 'true',
            }),
            node('deliver', 'DELIVER_TO_DIRECTORY', {
              Listings: '{{map.Listings}}',
              'Default category': 'Professional Services',
              'Region filter': 'true',
              Publish: 'false',
              Consolidate: 'false',
            }),
          ],
        },
      },
    },
  },
})

function node(id, type, inputs) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: id },
        type: { stringValue: type },
        inputs: {
          mapValue: {
            fields: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { stringValue: String(v) }])),
          },
        },
      },
    },
  }
}

async function countSource() {
  const url =
    'https://data.texas.gov/resource/jrea-zgmq.json?$select=' +
    encodeURIComponent('count(1) AS n') +
    '&$where=' +
    encodeURIComponent(WHERE)
  const rows = await fetch(url).then((r) => r.json())
  return Number(rows?.[0]?.n ?? 0)
}

/** The $offset already stored on the workflow, so an interrupted load resumes
 *  instead of re-walking pages it has already delivered. */
async function storedOffset(id) {
  if (!id) return 0
  const doc = await fetch(`${DB}/${COLL}/${id}`, { headers: auth }).then((r) => r.json())
  const nodes = doc.fields?.definition?.mapValue?.fields?.nodes?.arrayValue?.values || []
  const url = nodes.find((n) => n?.mapValue?.fields?.id?.stringValue === 'fetch')?.mapValue?.fields?.inputs?.mapValue
    ?.fields?.URL?.stringValue
  const m = String(url || '').match(/\$offset=(\d+)/)
  return m ? Number(m[1]) : 0
}

async function findWorkflow() {
  const res = await fetch(`${DB}:runQuery`, {
    method: 'POST',
    headers: jsonAuth,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: COLL }],
        where: { fieldFilter: { field: { fieldPath: 'template_key' }, op: 'EQUAL', value: { stringValue: KEY } } },
        limit: 1,
      },
    }),
  })
  const out = await res.json()
  const doc = (Array.isArray(out) ? out : []).find((d) => d.document)?.document
  return doc ? doc.name.split('/').pop() : null
}

async function upsertWorkflow(offset, enabled) {
  const existing = await findWorkflow()
  const fields = {
    name: { stringValue: 'TX Comptroller — BACK CATALOGUE (paged, unpublished)' },
    description: {
      stringValue:
        'One-off backfill of the full El Paso County sales-tax permit catalogue, paged with $offset over a deterministic taxpayer_number+outlet_number order. Publish=false ON PURPOSE: the search corpus is built from is_published==true and its loader throws past SEARCH_MAX_RECORDS (25,000); 9,454 are published today so publishing this would breach it and break search outright. Disable when the load completes.',
    },
    enabled: { booleanValue: Boolean(enabled) },
    // NOT 0. docToWorkflow does `Number(d.interval_hours) || 24`, so 0 is falsy
    // and silently becomes 24 hours — slice 2 then found the workflow "not due"
    // and the load stopped after one page. What actually makes it due is
    // clearing last_run_at below: the engine's first due-check is
    // `!w.last_run_at`, which short-circuits the interval arithmetic entirely.
    interval_hours: { integerValue: '24' },
    last_run_at: { nullValue: null },
    last_run_status: { nullValue: null },
    template_key: { stringValue: KEY },
    definition: definition(offset),
    updated_at: { stringValue: new Date().toISOString() },
  }
  if (existing) {
    const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join('&')
    const res = await fetch(`${DB}/${COLL}/${existing}?${mask}`, { method: 'PATCH', headers: jsonAuth, body: JSON.stringify({ fields }) })
    if (!res.ok) throw new Error(`patch failed: ${JSON.stringify(await res.json()).slice(0, 300)}`)
    return existing
  }
  fields.created_at = { stringValue: new Date().toISOString() }
  const res = await fetch(`${DB}/${COLL}`, { method: 'POST', headers: jsonAuth, body: JSON.stringify({ fields }) })
  const out = await res.json()
  if (!res.ok) throw new Error(`create failed: ${JSON.stringify(out).slice(0, 300)}`)
  return out.name.split('/').pop()
}

async function runSlice(dryRun) {
  const url = `${APP}/api/cron/scrapeflow?limit=1${dryRun ? '&dryRun=1' : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cronSecret}` } })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`cron failed ${res.status}: ${JSON.stringify(out).slice(0, 300)}`)
  return out
}

async function runSummary(runId) {
  const doc = await fetch(`${DB}/scrapeflow_runs/${runId}`, { headers: auth }).then((r) => r.json())
  const s = doc.fields?.summary?.mapValue?.fields || {}
  const n = (k) => Number(s[k]?.integerValue ?? 0)
  return { candidates: n('candidates'), inserted: n('inserted'), existing: n('skipped_existing'), invalid: n('skipped_invalid') }
}

async function publishedCount() {
  const res = await fetch(`${DB}:runAggregationQuery`, {
    method: 'POST',
    headers: jsonAuth,
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
  const total = await countSource()
  const slices = Math.ceil(total / PAGE)
  const pubBefore = await publishedCount()
  console.log(`source rows (El Paso, NAICS-filtered): ${total}`)
  console.log(`page size ${PAGE} => ${slices} slices`)
  console.log(`published before: ${pubBefore}  (cap 25,000)\n`)

  if (!APPLY) {
    const id = await upsertWorkflow(0, true)
    console.log(`workflow ${id} created/updated (enabled, offset 0). Running ONE dry slice…`)
    const out = await runSlice(true)
    const ran = out.ran?.[0]
    console.log(`  ${ran?.name} -> ${ran?.status}`)
    if (ran?.run_id) console.log('  summary:', await runSummary(ran.run_id))
    await upsertWorkflow(0, false)
    // Not "nothing written": a ScrapeFlow dry run inserts no listings and does not
    // advance the schedule, but it does record a scrapeflow_runs document and
    // overwrite the workflow's last_run_id / last_run_status, so the admin "last
    // run" shows the preview. No directory listing is created or changed.
    console.log('\nworkflow disabled again. DRY RUN — no listings written (a preview run record was saved). Re-run with --apply.')
    return
  }

  let offset = process.argv.includes('--resume') ? await storedOffset(await findWorkflow()) : 0
  if (offset) console.log(`resuming from stored offset ${offset}\n`)
  let slice = 0
  let insertedTotal = 0
  const started = Date.now()
  while (offset < total && slice < MAX_SLICES) {
    await upsertWorkflow(offset, true)
    const out = await runSlice(false)
    const ran = out.ran?.[0]
    if (!ran?.run_id) {
      console.log(`offset ${offset}: cron ran nothing (${JSON.stringify(out).slice(0, 160)}) — stopping`)
      break
    }
    const s = await runSummary(ran.run_id)
    insertedTotal += s.inserted
    slice++
    console.log(
      `slice ${String(slice).padStart(3)}  offset ${String(offset).padStart(6)}  candidates ${String(s.candidates).padStart(4)}  inserted ${String(s.inserted).padStart(4)}  existing ${String(s.existing).padStart(4)}  invalid ${String(s.invalid).padStart(4)}  (${ran.status})`
    )
    if (s.candidates === 0) {
      console.log('  no candidates returned — end of catalogue')
      break
    }
    offset += PAGE
  }

  await upsertWorkflow(offset, false)
  const pubAfter = await publishedCount()
  console.log(`\nworkflow DISABLED at offset ${offset}.`)
  console.log(`inserted total   : ${insertedTotal}`)
  console.log(`elapsed          : ${Math.round((Date.now() - started) / 1000)}s`)
  console.log(`published before : ${pubBefore}`)
  console.log(`published after  : ${pubAfter}   ${pubAfter === pubBefore ? '(unchanged — search index untouched)' : '*** CHANGED — investigate ***'}`)
}

main().catch((e) => {
  console.error(`\nFailed: ${e?.message || e}`)
  process.exit(1)
})
