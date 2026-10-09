import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import { NextRequest } from 'next/server'

test('Founders API creates moderated Basic drafts and refuses identity, duplicate and origin bypasses', async t => {
  const rows = new Map<string, any>()
  let user: any = { id: 'owner', email: 'owner@example.test', email_verified: true }, rate = true, available = true
  let serial = Promise.resolve()
  const ref = (id: string) => ({ id, get: async () => ({ id, exists: rows.has(id), data: () => rows.get(id) }) })
  const db = {
    collection: () => ({
      doc: ref,
      select: () => ({ limit: () => ({ get: async () => ({ docs: [...rows.entries()].map(([id, data]) => ({ id, data: () => data })) }) }) }),
      where: (field: string, _op: string, value: any) => ({
        limit: () => ({ get: async () => ({ docs: [...rows.entries()]
          .filter(([, v]) => v[field] === value)
          .map(([id, data]) => ({ id, data: () => data })) }) }),
      }),
    }),
    runTransaction: (fn: any) => {
      const p = serial.then(() => fn({ get: (r: any) => r.get(), create: (r: any, data: any) => { assert.ok(!rows.has(r.id)); rows.set(r.id, data) } }))
      serial = p.catch(() => {}); return p
    },
  }
  ;(globalThis as any).__foundersTest = { db, user: () => user, rate: () => ({ ok: rate }), available: () => available }
  const bundled = await build({ entryPoints: [path.resolve('src/app/api/founders/route.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^(@citybeat\/lib\/firebase\/(admin|server)|@\/lib\/(auth-security|sales-founding))$/ }, a => ({ path: a.path, namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents: a.path.endsWith('/admin') ? 'export const adminDb=globalThis.__foundersTest.db' : a.path.endsWith('/server') ? 'export const getServerUser=async()=>globalThis.__foundersTest.user()' : a.path.endsWith('sales-founding') ? 'export const foundingOfferAvailable=async()=>globalThis.__foundersTest.available()' : 'export const checkRateLimit=async()=>globalThis.__foundersTest.rate(); export const getClientIp=()=>"test"' }))
  } }] })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), mod, mod.exports)
  const input = { name: 'Clinic', category: 'Health', phone: '915-555-0100', addresses: ['123 Main Street, El Paso TX 79901'], attested: true }
  const submit = (body: any = input, origin = 'https://citybeatmag.co') => mod.exports.POST(new NextRequest('https://citybeatmag.co/api/founders', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  try {
    await t.test('signed out, unverified identity and foreign origin cannot create records', async () => {
      user = null; assert.equal((await submit()).status, 401)
      user = { id: 'owner', email_verified: false }; assert.equal((await submit()).status, 403)
      user = { id: 'owner', email: 'owner@example.test', email_verified: true }
      assert.equal((await submit(input, 'https://evil.test')).status, 403)
      rate = false; assert.equal((await submit()).status, 429); rate = true
      assert.equal(rows.size, 0)
    })
    await t.test('concurrent submissions make one unpublished Basic draft, never a paid or approved listing', async () => {
      const responses = await Promise.all([submit({ ...input, tier: 'premium', claim_status: 'approved' }), submit()])
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409])
      assert.equal(rows.size, 1)
      const row = [...rows.values()][0]
      assert.equal(row.tier, 'basic'); assert.equal(row.pending_tier, 'basic'); assert.equal(row.is_published, false)
      assert.equal(row.claim_status, 'pending_approval'); assert.equal(row.ownership_verified, false)
      assert.equal(row.owner_id, 'owner'); assert.equal(row.stripe_subscription_id, undefined)
    })
    await t.test('duplicates do not transfer ownership or reveal a private draft id', async () => {
      user = { id: 'stranger', email: 'stranger@example.test', email_verified: true }
      const response = await submit({ ...input, name: 'CLINIC!' }); assert.equal(response.status, 409)
      assert.equal((await response.json()).listingId, null)
      assert.equal([...rows.values()][0].owner_id, 'owner')
    })
    await t.test('sold out status does not prevent a free Basic submission', async () => {
      available = false
      const status = await mod.exports.GET(new NextRequest('https://citybeatmag.co/api/founders'))
      assert.equal((await status.json()).available, false)
      assert.equal((await submit({ ...input, name: 'Different Company', phone: '915-555-0101', addresses: ['999 Second Street, El Paso TX 79901'] })).status, 201)
    })
  } finally { delete (globalThis as any).__foundersTest }
})
