import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import { NextRequest } from 'next/server'

test('owner reports records no-work heartbeat without report or email side effects', async t => {
  let docs: any[] = [], queryFails = false
  const successes: string[] = [], failures: string[] = [], rejected: string[] = []
  let reads = 0, deliveryCalls = 0
  const fixture = {
    db: { collection(name: string) {
      assert.equal(name, 'directory_listings', 'No analytics or delivery collection should be touched')
      return { where(field: string, op: string, value: string) {
        assert.deepEqual([field, op, value], ['claim_status', '==', 'approved'])
        return { async get() { reads++; if (queryFails) throw new Error('fixture query failure'); return { docs } } }
      } }
    } },
    success: async (source: string) => { successes.push(source) },
    failure: async (source: string) => { failures.push(source) },
    rejected: async (source: string) => { rejected.push(source) },
    forbidden: async () => { deliveryCalls++; throw new Error('Real delivery is forbidden in this test') },
  }
  const previousSecret = process.env.CRON_SECRET
  const previousFetch = globalThis.fetch
  process.env.CRON_SECRET = 'local-test-only'
  globalThis.fetch = async () => { throw new Error('Network forbidden in owner report test') }
  ;(globalThis as any).__ownerReportHeartbeat = fixture
  try {
    const modules: Record<string, string> = {
      '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
      '@/lib/alerts': 'export const reportSuccess=f.success, reportFailure=f.failure, reportCronAuthRejected=f.rejected',
      '@/lib/email': 'export const sendEmail=f.forbidden',
      '@/lib/user-notifications': 'export const notifyUser=f.forbidden',
      '@/lib/notify-prefs': 'export const getNotifyPrefs=f.forbidden',
      '@/lib/unsub-headers': 'export const unsubHeaders=f.forbidden',
      '@/lib/suppression': 'export const isSuppressed=f.forbidden',
      '@/lib/premium-value': 'export const customerActionTotal=f.forbidden',
      '@/lib/listing-scores': 'export const profileCompleteness=f.forbidden',
      '@/lib/listing-analytics': 'export const dayKey=()=>"2026-10-19", daysAgoKey=()=>"2026-09-01", totalsForRange=f.forbidden',
    }
    const bundled = await build({ entryPoints: [path.resolve('src/app/api/cron/owner-reports/route.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'offline-only', setup(b) {
      b.onResolve({ filter: /^(@citybeat\/|@\/)/ }, a => {
        if (!modules[a.path]) throw new Error(`Unmocked dependency: ${a.path}`)
        return { path: a.path, namespace: 'fixture' }
      })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents: `const f=globalThis.__ownerReportHeartbeat; ${modules[a.path]}` }))
    } }] })
    const mod = { exports: {} as any }
    new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), mod, mod.exports)
    const run = (token = 'local-test-only') => mod.exports.GET(new NextRequest('https://example.test/api/cron/owner-reports', { headers: { authorization: `Bearer ${token}` } }))
    await t.test('empty approved listings records successful heartbeat', async () => {
      const response = await run()
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { ok: true, skipped: 'no_claimed_listings' })
      assert.deepEqual(successes, ['cron:owner-reports'])
    })
    await t.test('approved listings without owners also record heartbeat', async () => {
      docs = [{ id: 'unowned', data: () => ({ owner_id: null }) }]
      assert.equal((await run()).status, 200)
      assert.equal(successes.length, 2)
    })
    await t.test('query failures are not recorded as successful runs', async () => {
      queryFails = true
      assert.equal((await run()).status, 500)
      assert.equal(successes.length, 2)
      assert.deepEqual(failures, ['cron:owner-reports'])
    })
    await t.test('invalid authorization cannot record a heartbeat or query listings', async () => {
      const priorReads = reads
      assert.equal((await run('wrong')).status, 401)
      assert.equal(reads, priorReads)
      assert.equal(successes.length, 2)
      assert.deepEqual(rejected, ['cron:owner-reports'])
    })
    assert.equal(deliveryCalls, 0)
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
    globalThis.fetch = previousFetch
    delete (globalThis as any).__ownerReportHeartbeat
  }
})
