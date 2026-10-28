import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'

// A send that FAILED reached nobody, so it must not use up the business's one
// pitch. Every outreach ledger dedupes on the existence of a row whatever its
// status, and a failed send used to write a 'send_failed' row: one provider
// outage, a rate limit or a missing key cancelled a whole batch of first touches
// for good, and nothing said so.
//
// These run against a fake Firestore with real replace/merge/increment semantics,
// a provider whose answer the test controls, and the real sales-agent module.

type Row = Record<string, any>
type Seed = Record<string, Array<{ id: string; data: Row }>>

function fakeDb(seed: Seed) {
  const stores = new Map<string, Map<string, Row>>()
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map((seed[name] || []).map((d) => [d.id, { ...d.data }])))
    return stores.get(name)!
  }
  const apply = (prev: Row, data: Row) => {
    const out: Row = { ...prev }
    for (const [k, v] of Object.entries(data)) {
      const method = (v as any)?.methodName
      if (method === 'FieldValue.serverTimestamp') out[k] = { toDate: () => new Date() }
      else if (method === 'FieldValue.increment') out[k] = (Number(prev[k]) || 0) + (v as any).operand
      else out[k] = v
    }
    return out
  }
  const handle = (name: string, id: string): any => ({
    id,
    async get() { return snap(name, id) },
    // Firestore set() REPLACES the document unless merge is asked for.
    async set(data: Row, opts?: { merge?: boolean }) {
      store(name).set(id, apply(opts?.merge ? store(name).get(id) || {} : {}, data))
    },
  })
  const snap = (name: string, id: string): any => {
    const data = store(name).get(id)
    return { id, exists: data !== undefined, data: () => data, get: (f: string) => data?.[f], ref: handle(name, id) }
  }
  let auto = 0
  return {
    dump: (name: string) => store(name),
    collection(name: string) {
      const preds: Array<(d: Row) => boolean> = []
      const q: any = {
        where(field: string, op: string, value: any) {
          if (op === '==') preds.push((d) => d[field] === value)
          else if (op === 'in') preds.push((d) => (value as any[]).includes(d[field]))
          else if (op === '>') preds.push((d) => d[field] !== undefined && d[field] > value)
          return q
        },
        orderBy: () => q,
        limit: () => q,
        select: () => q,
        async get() {
          const docs = [...store(name).keys()].filter((id) => preds.every((p) => p(store(name).get(id)!))).map((id) => snap(name, id))
          return { docs, empty: docs.length === 0, size: docs.length }
        },
        doc(id?: string) { return handle(name, id ?? `auto${++auto}`) },
      }
      return q
    },
  }
}

const DAY = 86400000
type Outcome = { sent: boolean; error?: string }

async function setup(seed: Seed) {
  delete process.env.ANTHROPIC_API_KEY
  const db = fakeDb(seed)
  const attempts: string[] = []
  const provider = { next: { sent: true } as Outcome }
  const f = {
    db,
    sendEmail: async (to: string): Promise<Outcome> => { attempts.push(to); return provider.next },
    noop: async () => undefined,
  }
  ;(globalThis as any).__salesAgentFailedSends = f
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
      b.onResolve({ filter: /^(@citybeat\/|@\/|\.\/)/ }, (a) => {
        if (!modules[a.path]) throw new Error('Unmocked dependency: ' + a.path)
        return { path: a.path, namespace: 'fixture' }
      })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ loader: 'js', contents: 'const f=globalThis.__salesAgentFailedSends; ' + modules[a.path] }))
    } }],
  })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), mod, mod.exports)
  const api = mod.exports as {
    MAX_SEND_ATTEMPTS: number
    failedSendIsRetryable: (row: Row | null | undefined) => boolean
    sendFailureIsFinal: (error: unknown) => boolean
    runSalesOutreach: (o: { limit?: number; dryRun?: boolean; locale?: 'en' | 'es' }) => Promise<Row>
    runRecoveryOutreach: (o: { limit?: number; dryRun?: boolean }) => Promise<Row>
    runUpsellOutreach: (o: { limit?: number; dryRun?: boolean }) => Promise<Row>
  }
  return { api, db, attempts, provider }
}

const biz = (id: string, extra: Row = {}) => ({
  id,
  data: { name: `Biz ${id}`, category: 'Beauty', email: `${id.toLowerCase()}@${id.toLowerCase()}.test`, claim_status: 'unclaimed', is_published: true, ...extra },
})
const OUT_OF_SERVICE: Outcome = { sent: false, error: 'resend_503' }

test('which failed sends are worth another try', async () => {
  const { api } = await setup({})
  assert.equal(api.failedSendIsRetryable({ status: 'send_failed', send_attempts: 1, send_error: 'resend_503' }), true)
  assert.equal(api.failedSendIsRetryable({ status: 'send_failed', send_error: 'no_email_provider_key' }), true, 'a row written before attempts were counted made one')
  assert.equal(api.failedSendIsRetryable({ status: 'send_failed', send_attempts: api.MAX_SEND_ATTEMPTS, send_error: 'resend_503' }), false, 'bounded')
  assert.equal(api.failedSendIsRetryable({ status: 'send_failed', send_attempts: 1, send_error: 'resend_422' }), false, 'the recipient itself was refused')
  assert.equal(api.failedSendIsRetryable({ status: 'sent' }), false, 'delivered is delivered')
  assert.equal(api.failedSendIsRetryable({ status: 'dry_run' }), false)
  assert.equal(api.failedSendIsRetryable(undefined), false)
  assert.equal(api.sendFailureIsFinal('resend_400'), true)
  assert.equal(api.sendFailureIsFinal('resend_429'), false)
  assert.equal(api.sendFailureIsFinal('no_email_provider_key'), false)
})

test('a first touch that failed to send is retried in place on the next run, then not again', async () => {
  const { api, db, attempts, provider } = await setup({ directory_listings: [biz('A1'), biz('A2')] })

  provider.next = OUT_OF_SERVICE
  const first = await api.runSalesOutreach({ limit: 5, locale: 'en' })
  assert.equal(first.contacted, 2)
  assert.equal(first.sent, 0)
  const ledger = db.dump('sales_outreach')
  assert.equal(ledger.size, 2)
  for (const row of ledger.values()) {
    assert.equal(row.status, 'send_failed')
    assert.equal(row.send_attempts, 1)
    assert.equal(row.send_error, 'resend_503')
  }
  const idsAfterFailure = [...ledger.keys()].sort()

  provider.next = { sent: true }
  const second = await api.runSalesOutreach({ limit: 5, locale: 'en' })
  assert.equal(second.contacted, 2, 'the outage must not have cancelled these pitches')
  assert.equal(second.retried, 2)
  assert.equal(second.sent, 2)
  assert.deepEqual([...db.dump('sales_outreach').keys()].sort(), idsAfterFailure, 'retried in place: no second row per business')
  for (const row of db.dump('sales_outreach').values()) {
    assert.equal(row.status, 'sent')
    assert.equal(row.send_attempts, 2)
    assert.equal('send_error' in row, false, 'a delivered row carries no failure')
  }

  const sentBefore = attempts.length
  const third = await api.runSalesOutreach({ limit: 5, locale: 'en' })
  assert.equal(third.contacted, 0, 'delivered once means done')
  assert.equal(attempts.length, sentBefore)
})

test('a refused address settles at once and a persistent failure stops at the attempt cap', async () => {
  const refused = await setup({ directory_listings: [biz('R1')] })
  refused.provider.next = { sent: false, error: 'resend_422' }
  assert.equal((await refused.api.runSalesOutreach({ limit: 5, locale: 'en' })).contacted, 1)
  refused.provider.next = { sent: true }
  assert.equal((await refused.api.runSalesOutreach({ limit: 5, locale: 'en' })).contacted, 0, 'retrying a refused address cannot help')

  const stuck = await setup({ directory_listings: [biz('S1')] })
  stuck.provider.next = OUT_OF_SERVICE
  for (let run = 1; run <= stuck.api.MAX_SEND_ATTEMPTS; run++) {
    assert.equal((await stuck.api.runSalesOutreach({ limit: 5, locale: 'en' })).contacted, 1, `attempt ${run}`)
  }
  stuck.provider.next = { sent: true }
  assert.equal((await stuck.api.runSalesOutreach({ limit: 5, locale: 'en' })).contacted, 0, 'after the cap the failure is final')
  assert.equal([...stuck.db.dump('sales_outreach').values()][0].status, 'send_failed')
})

test('a run stops after three consecutive failures instead of working through the queue', async () => {
  const { api, db, attempts, provider } = await setup({ directory_listings: ['B1', 'B2', 'B3', 'B4', 'B5'].map((id) => biz(id)) })
  provider.next = OUT_OF_SERVICE
  const run = await api.runSalesOutreach({ limit: 10, locale: 'en' })
  assert.equal(run.halted, 'consecutive_send_failures')
  assert.equal(run.last_send_error, 'resend_503')
  assert.equal(attempts.length, 3, 'two businesses were never touched')
  assert.equal(db.dump('sales_outreach').size, 3)

  provider.next = { sent: true }
  const next = await api.runSalesOutreach({ limit: 10, locale: 'en' })
  assert.equal(next.contacted, 5, 'the three retries plus the two that were never attempted')
  assert.equal(next.sent, 5)
})

test('a follow-up that failed to send does not skip its step, and is given up on after the cap', async () => {
  const row = (listing: string, extra: Row = {}) => ({
    id: `o-${listing}`,
    data: { listing_id: listing, email: `${listing.toLowerCase()}@${listing.toLowerCase()}.test`, business_name: `Biz ${listing}`, category: 'Beauty', status: 'sent', step: 0, locale: 'en', last_sent_at: { toDate: () => new Date(Date.now() - 10 * DAY) }, ...extra },
  })
  const { api, db, provider } = await setup({
    directory_listings: [biz('F1'), biz('F2')],
    sales_outreach: [row('F1'), row('F2', { followup_failures: 3 })],
  })

  provider.next = OUT_OF_SERVICE
  const failed = await api.runSalesOutreach({ limit: 5, locale: 'en' })
  assert.equal(failed.followups, 1, 'F2 has failed three times and is no longer attempted')
  const f1 = db.dump('sales_outreach').get('o-F1')!
  assert.equal(f1.step, 0, 'the reminder that failed is still the next one due')
  assert.equal(f1.followup_failures, 1)
  assert.equal(f1.status, 'sent', 'a delivered first touch stays delivered')

  provider.next = { sent: true }
  const ok = await api.runSalesOutreach({ limit: 5, locale: 'en' })
  assert.equal(ok.followups, 1)
  assert.equal(ok.sent, 1)
  const after = db.dump('sales_outreach').get('o-F1')!
  assert.equal(after.step, 1)
  assert.equal(after.followup_failures, 0)
  assert.equal(db.dump('sales_outreach').get('o-F2')!.step, 0, 'the given-up row was left alone')
})

const stalledClaim = (n: number) => ({
  claims: { id: `c${n}`, data: { status: 'code_sent', listing_id: `L${n}`, user_id: `u${n}`, created_at: { toDate: () => new Date(Date.now() - 3 * DAY) } } },
  profile: { id: `u${n}`, data: { email: `stalled${n}@example.test`, locale: 'en' } },
  listing: { id: `L${n}`, data: { name: `Stalled ${n}`, claim_status: 'unclaimed' } },
})

test('a recovery nudge that failed to send is retried, not cancelled', async () => {
  const s = stalledClaim(1)
  const { api, db, provider } = await setup({ directory_claims: [s.claims], profiles: [s.profile], directory_listings: [s.listing] })

  provider.next = OUT_OF_SERVICE
  assert.equal((await api.runRecoveryOutreach({})).incomplete_claims, 1)
  const failed = db.dump('recovery_outreach').get('claim:L1:u1')!
  assert.equal(failed.status, 'send_failed')
  assert.equal(failed.send_attempts, 1)
  assert.equal(failed.send_error, 'resend_503')

  provider.next = { sent: true }
  const retry = await api.runRecoveryOutreach({})
  assert.equal(retry.incomplete_claims, 1, 'the outage must not have used up this nudge')
  assert.equal(retry.sent, 1)
  const sent = db.dump('recovery_outreach').get('claim:L1:u1')!
  assert.equal(sent.status, 'sent')
  assert.equal(sent.send_attempts, 2)
  assert.equal('send_error' in sent, false)

  assert.equal((await api.runRecoveryOutreach({})).incomplete_claims, 0, 'one delivered nudge per target')
})

test('recovery stops after three consecutive failures, and a dry run never counts as one', async () => {
  const claims = [1, 2, 3, 4, 5].map(stalledClaim)
  const { api, attempts, provider } = await setup({
    directory_claims: claims.map((c) => c.claims),
    profiles: claims.map((c) => c.profile),
    directory_listings: claims.map((c) => c.listing),
  })

  provider.next = OUT_OF_SERVICE
  const preview = await api.runRecoveryOutreach({ dryRun: true })
  assert.equal(preview.halted, false, 'a preview sends nothing, so nothing failed')
  assert.equal(preview.incomplete_claims, 5)
  assert.equal(attempts.length, 0)

  const run = await api.runRecoveryOutreach({})
  assert.equal(run.halted, true)
  assert.equal(attempts.length, 3)
})

test('an upsell that failed to send is retried in place', async () => {
  const { api, db, provider } = await setup({ directory_listings: [{ id: 'U1', data: { name: 'Premium Plumber', claim_status: 'approved', tier: 'premium', email: 'premium@example.test' } }] })

  provider.next = OUT_OF_SERVICE
  assert.equal((await api.runUpsellOutreach({})).contacted, 1)
  const [id] = [...db.dump('upsell_outreach').keys()]
  assert.equal(db.dump('upsell_outreach').get(id)!.status, 'send_failed')

  provider.next = { sent: true }
  const retry = await api.runUpsellOutreach({})
  assert.equal(retry.contacted, 1)
  assert.equal(retry.sent, 1)
  assert.deepEqual([...db.dump('upsell_outreach').keys()], [id], 'same row, not a second one')
  assert.equal(db.dump('upsell_outreach').get(id)!.send_attempts, 2)

  assert.equal((await api.runUpsellOutreach({})).contacted, 0, 'one upsell per listing, ever')
})
