import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'

test('queue API saves batches durably, deduplicates and protects edits', async t => {
  const rows = new Map<string, any>()
  let serial = Promise.resolve(), saved = 0, denied = false
  const ref = (key: string) => ({ key, get: async () => ({ exists: rows.has(key), data: () => rows.get(key) }) })
  const fixture = {
    db: { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }), runTransaction: (fn: any) => {
      const p = serial.then(() => fn({ get: (r: any) => r.get(), set: (r: any, d: any) => rows.set(r.key, d), update: (r: any, d: any) => rows.set(r.key, { ...rows.get(r.key), ...d }) }))
      serial = p.catch(() => {}); return p
    } },
    storage: { bucket: () => ({ name: 'test', file: () => ({ save: async () => { saved++ } }) }) },
    auth: async () => denied ? { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } : { user: { id: 'admin-fixture' } },
  }
  ;(globalThis as any).__socialApiTest = fixture
  const result = await build({ entryPoints: [path.resolve(process.cwd().endsWith('web') ? 'src/app/api/admin/social-queue/route.ts' : 'apps/web/src/app/api/admin/social-queue/route.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', alias: { '@/lib/social-queue': path.resolve(process.cwd().endsWith('web') ? 'src/lib/social-queue.ts' : 'apps/web/src/lib/social-queue.ts'), '@/lib/social-queue-policy': path.resolve(process.cwd().endsWith('web') ? 'src/lib/social-queue-policy.ts' : 'apps/web/src/lib/social-queue-policy.ts'), '@/lib/social-schedule': path.resolve(process.cwd().endsWith('web') ? 'src/lib/social-schedule.ts' : 'apps/web/src/lib/social-schedule.ts') }, plugins: [{ name: 'api-fixtures', setup(b) {
    b.onResolve({ filter: /^@citybeat\/lib\/firebase\/admin$/ }, () => ({ path: 'firebase', namespace: 'fixture' }))
    b.onResolve({ filter: /^@\/lib\/admin-automation-auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
    b.onResolve({ filter: /^\.\/http$/ }, () => ({ path: 'http', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'firebase' ? 'export const adminDb=globalThis.__socialApiTest.db; export const adminStorage=globalThis.__socialApiTest.storage' : args.path === 'auth' ? 'export const automationAdmin=globalThis.__socialApiTest.auth' : 'export function fetchWithTimeout(){throw new Error("Upload/edit must never call AI or Facebook")}', loader: 'js' }))
  } }] })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(path.join(process.cwd(), 'package.json')), mod, mod.exports)
  const api = mod.exports
  const upload = async (color: string, rights = true) => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toBuffer()
    const form = new FormData(); form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), color + '.png'); form.set('rights_confirmed', String(rights))
    return api.POST(new NextRequest('https://citybeatmag.co/api/admin/social-queue', { method: 'POST', body: form }))
  }
  const change = async (id: string, action: string, more: any = {}) => api.PATCH(new NextRequest('https://citybeatmag.co/api/admin/social-queue', { method: 'PATCH', body: JSON.stringify({ id, action, ...more }), headers: { 'Content-Type': 'application/json' } }))
  try {
    let id = '', other = ''
    await t.test('multiple uploads reserve distinct slots without invoking models or Facebook', async () => {
      const responses = await Promise.all([upload('red'), upload('blue')])
      assert.deepEqual(responses.map(r => r.status), [201, 201])
      const bodies = await Promise.all(responses.map(r => r.json())); id = bodies[0].id; other = bodies[1].id
      assert.equal(saved, 2)
      assert.equal(rows.get(`social_image_queue/${id}`).status, 'queued')
      assert.notEqual(rows.get(`social_image_queue/${id}`).scheduled_at, rows.get(`social_image_queue/${other}`).scheduled_at)
      assert.equal((await upload('red')).status, 409)
      assert.equal(saved, 2)
    })
    await t.test('rights and auth rejection are non-mutating', async () => {
      assert.equal((await upload('green', false)).status, 400)
      denied = true; assert.equal((await upload('green')).status, 401); denied = false
      assert.equal(saved, 2)
    })
    await t.test('pause releases slot and stale review is invalidated on edit', async () => {
      const key = `social_image_queue/${id}`, control = 'automation_settings/social-image-queue'
      const oldSlot = rows.get(key).scheduled_at
      assert.equal((await change(id, 'pause')).status, 200)
      assert.equal(rows.get(key).status, 'paused')
      assert.equal(rows.get(control).slots[String(oldSlot)], undefined)
      rows.get(key).reviewed_at = Date.now(); rows.get(key).caption = 'Old caption'
      assert.equal((await change(id, 'edit', { notes: 'Revised verified facts', caption: 'Manual caption' })).status, 200)
      assert.equal(rows.get(key).status, 'queued'); assert.equal(rows.get(key).reviewed_at, null)
      assert.equal(rows.get(key).caption_override, 'Manual caption')
    })
    await t.test('occupied/invalid slots and uncertain publication edits are rejected', async () => {
      assert.equal((await change(id, 'reschedule', { scheduled_at: rows.get(`social_image_queue/${other}`).scheduled_at })).status, 409)
      assert.equal((await change(id, 'reschedule', { scheduled_at: Date.now() })).status, 400)
      rows.get(`social_image_queue/${id}`).status = 'publish_uncertain'
      assert.equal((await change(id, 'retry')).status, 409)
      assert.equal((await change(id, 'cancel')).status, 409)
    })
  } finally { delete (globalThis as any).__socialApiTest }
})
