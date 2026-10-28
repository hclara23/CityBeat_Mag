import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'

// A dry run is a PREVIEW ("who would you nudge?") and must leave no trace.
//
// Why it matters here: both runRecoveryOutreach and runUpsellOutreach decide
// "already contacted" by looking for a row in their own ledger collection, and
// they used to write a row even on a dry run (status 'dry_run'). That row looked
// exactly like a real one to the next real run, so a preview permanently cancelled
// the very sends it listed. The cron route hands dryRun to BOTH functions, so a
// single ?dryRun=1 on /api/cron/sales-agent would have done it.
//
// The test runs dry first and real second against the SAME fake database: the
// assertion that matters is that the real run still has everything to do.

type Doc = { id: string; data: Record<string, any> }

function fakeDb(seed: Record<string, Doc[]>, writes: Array<{ coll: string; id: string }>) {
  const stores = new Map<string, Map<string, Record<string, any>>>()
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map((seed[name] || []).map(d => [d.id, d.data])))
    return stores.get(name)!
  }
  const snap = (id: string, data?: Record<string, any>) => ({ id, exists: data !== undefined, data: () => data, ref: { id } })
  let auto = 0
  return {
    collection(name: string) {
      const preds: Array<(d: Record<string, any>) => boolean> = []
      const query: any = {
        where(field: string, op: string, value: any) {
          if (op === '==') preds.push(d => d[field] === value)
          else if (op === 'in') preds.push(d => (value as any[]).includes(d[field]))
          return query
        },
        orderBy: () => query,
        limit: () => query,
        async get() {
          const docs = [...store(name).entries()].filter(([, d]) => preds.every(p => p(d))).map(([id, d]) => snap(id, d))
          return { docs, empty: docs.length === 0 }
        },
        doc(id?: string) {
          const docId = id ?? `auto${++auto}`
          return {
            id: docId,
            async get() { return snap(docId, store(name).get(docId)) },
            async set(data: Record<string, any>) { writes.push({ coll: name, id: docId }); store(name).set(docId, { ...(store(name).get(docId) || {}), ...data }) },
          }
        },
      }
      return query
    },
  }
}

const DAY = 86400000
const seed = (): Record<string, Doc[]> => ({
  // Segment 1: a claim that stalled 3 days ago on a listing still up for grabs.
  directory_claims: [{ id: 'c1', data: { status: 'code_sent', listing_id: 'L1', user_id: 'u1', created_at: { toDate: () => new Date(Date.now() - 3 * DAY) } } }],
  profiles: [
    { id: 'u1', data: { email: 'stalled@example.test', locale: 'en' } },
    { id: 'u2', data: { email: 'basic@example.test', locale: 'es' } },
    { id: 'u3', data: { email: 'churned@example.test', locale: 'en' } },
  ],
  directory_listings: [
    { id: 'L1', data: { name: 'Stalled Claim Cafe', claim_status: 'unclaimed' } },
    // Segment 2: claimed free more than 3 days ago, still Basic.
    { id: 'L2', data: { name: 'Basic Owner Shop', claim_status: 'approved', tier: 'basic', owner_id: 'u2', claimed_at: new Date(Date.now() - 5 * DAY).toISOString() } },
    // Segment 3: a churned subscriber whose cool-off has passed, no longer paying.
    { id: 'L3', data: { name: 'Churned Garage', claim_status: 'approved', tier: 'basic', owner_id: 'u3', stripe_subscription_id: 'sub_churned', claimed_at: new Date().toISOString() } },
    // Upsell: an approved Premium listing with an address on file.
    { id: 'U1', data: { name: 'Premium Plumber', claim_status: 'approved', tier: 'premium', email: 'premium@example.test' } },
  ],
  subscriptions: [{ id: 'sub_churned', data: { status: 'canceled', winback_due_at: new Date(Date.now() - DAY).toISOString() } }],
})

async function load(sent: string[], writes: Array<{ coll: string; id: string }>, db: any) {
  const f = {
    db,
    sendEmail: async (to: string) => { sent.push(to); return { sent: true } },
    noop: async () => undefined,
  }
  ;(globalThis as any).__salesAgentDryRun = f
  const modules: Record<string, string> = {
    '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
    './email': 'export const sendEmail=f.sendEmail',
    './suppression': 'export const isSuppressed=async()=>false',
    './alerts': 'export const reportFailure=f.noop',
    '@/lib/observability': 'export const traceClaude=f.noop, traceClaudeFailure=f.noop',
    './pricing': 'export const DIRECTORY_PLANS={premium_monthly:{unitAmount:1999}}',
    './http': 'export const fetchWithTimeout=async()=>{throw new Error("network forbidden")}, FETCH_TIMEOUT_LLM=1',
    './unsub-headers': 'export const unsubHeaders=()=>({})',
    './enrich-contacts': 'export const isChainLocatorUrl=()=>false, isOwnInbox=()=>true',
    './listing-cursor': 'export const encodeListingCursor=()=>null, decodeListingCursor=()=>null',
  }
  const bundled = await build({
    entryPoints: [path.resolve('src/lib/sales-agent.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
    plugins: [{ name: 'offline-only', setup(b) {
      b.onResolve({ filter: /^(@citybeat\/|@\/|\.\/)/ }, a => {
        if (!modules[a.path]) throw new Error('Unmocked dependency: ' + a.path)
        return { path: a.path, namespace: 'fixture' }
      })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents: 'const f=globalThis.__salesAgentDryRun; ' + modules[a.path] }))
    } }],
  })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), mod, mod.exports)
  return mod.exports as {
    runRecoveryOutreach: (o: { limit?: number; dryRun?: boolean }) => Promise<Record<string, number | boolean>>
    runUpsellOutreach: (o: { limit?: number; dryRun?: boolean }) => Promise<Record<string, number | boolean>>
  }
}

test('a recovery dry run reports the nudges but leaves no ledger row, so the real run still sends them', async () => {
  const sent: string[] = [], writes: Array<{ coll: string; id: string }> = []
  const api = await load(sent, writes, fakeDb(seed(), writes))

  const dry = await api.runRecoveryOutreach({ dryRun: true })
  assert.equal(dry.dryRun, true)
  assert.equal(dry.incomplete_claims, 1, 'the preview must still report what it would do (otherwise this test proves nothing)')
  assert.equal(dry.basic_upsells, 1)
  assert.equal(dry.sent, 0)
  assert.equal(sent.length, 0, 'a dry run never emails')
  assert.equal(writes.length, 0, 'a dry run never writes to recovery_outreach')

  const real = await api.runRecoveryOutreach({})
  assert.equal(real.incomplete_claims, 1, 'the preview must not have used up the stalled-claim nudge')
  assert.equal(real.basic_upsells, 1, 'the preview must not have used up the basic-to-Premium nudge')
  assert.equal(real.sent, 3, 'stalled claim + basic upsell + win-back all go out for real')
  assert.equal(sent.length, 3)
  assert.equal(writes.filter(w => w.coll === 'recovery_outreach').length, 3, 'a real run records each send exactly once')

  // And the ledger now does what it is for: nobody is nudged twice.
  const again = await api.runRecoveryOutreach({})
  assert.equal(again.sent, 0)
  assert.equal(sent.length, 3)
})

test('an upsell dry run leaves no ledger row, so the real run still sends it', async () => {
  const sent: string[] = [], writes: Array<{ coll: string; id: string }> = []
  const api = await load(sent, writes, fakeDb(seed(), writes))

  const dry = await api.runUpsellOutreach({ dryRun: true })
  assert.equal(dry.contacted, 1, 'the preview must still report the Premium owner it would pitch')
  assert.equal(dry.sent, 0)
  assert.equal(sent.length, 0)
  assert.equal(writes.length, 0, 'a dry run never writes to upsell_outreach')

  const real = await api.runUpsellOutreach({})
  assert.equal(real.contacted, 1, 'the preview must not have used up the one upsell this listing gets')
  assert.equal(real.sent, 1)
  assert.deepEqual(sent, ['premium@example.test'])
  assert.deepEqual(writes.map(w => w.coll), ['upsell_outreach'])

  const again = await api.runUpsellOutreach({})
  assert.equal(again.contacted, 0, 'one upsell per listing, ever')
})
