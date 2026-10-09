import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'

test('real queue worker: transactional claims, independent review and no early/duplicate publication', async t => {
  const rows = new Map<string, any>()
  const sent: string[] = []
  let verdict = true, failFacebook = false
  let serial = Promise.resolve()
  const ref = (key: string) => ({ key, get: async () => snap(key) })
  const snap = (key: string) => ({ exists: rows.has(key), data: () => rows.get(key), ref: ref(key), id: key.split('/').at(-1) })
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: (fn: any) => {
      const run = serial.then(() => fn({ get: (r: any) => r.get(), set: (r: any, data: any) => rows.set(r.key, data), update: (r: any, data: any) => rows.set(r.key, { ...rows.get(r.key), ...data }) }))
      serial = run.catch(() => {})
      return run
    },
  }
  const fixture = { db, storage: { bucket: () => ({ file: () => ({ download: async () => [Buffer.from('fixture')] }) }) },
    fetch: async (url: string, init: any) => {
      if (url.includes('openai')) {
        sent.push('ai')
        const body = JSON.parse(init.body)
        const answer = body.response_format.json_schema.name === 'review' ? { approved: verdict, reason: 'Fixture verdict' } : { caption: 'Reviewed community graphic.' }
        return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] }) }
      }
      sent.push('facebook')
      if (failFacebook) throw new Error('timeout')
      assert.equal(JSON.parse(init.body).published, true)
      return { ok: true, json: async () => ({ id: 'photo', post_id: 'page_post' }) }
    } }
  ;(globalThis as any).__socialQueueTest = fixture
  const result = await build({ entryPoints: [path.resolve(process.cwd().endsWith('web') ? 'src/lib/social-queue.ts' : 'apps/web/src/lib/social-queue.ts')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', plugins: [{ name: 'mock-boundaries', setup(b) {
    b.onResolve({ filter: /^@citybeat\/lib\/firebase\/admin$/ }, () => ({ path: 'firebase', namespace: 'fixture' }))
    b.onResolve({ filter: /^\.\/http$/ }, () => ({ path: 'http', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'firebase' ? 'export const adminDb=globalThis.__socialQueueTest.db; export const adminStorage=globalThis.__socialQueueTest.storage' : 'export const fetchWithTimeout=globalThis.__socialQueueTest.fetch', loader: 'js' }))
  } }] })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(path.join(process.cwd(), 'package.json')), mod, mod.exports)
  const worker = mod.exports
  const env = { ...process.env }, oldNow = Date.now
  let now = Date.parse('2026-10-09T05:00:00Z')
  Date.now = () => now
  process.env.SOCIAL_IMAGE_QUEUE_ENABLED = 'true'; process.env.OPENAI_API_KEY = 'test-only'; process.env.FB_PAGE_ID = '112338362142224'; process.env.FB_PAGE_ACCESS_TOKEN = 'test-only'; process.env.MEDIA_BUCKET = 'test-bucket'
  const id = 'a'.repeat(64), key = `social_image_queue/${id}`, control = 'automation_settings/social-image-queue'
  const seed = () => {
    rows.clear(); sent.length = 0; verdict = true; failFacebook = false; now = Date.parse('2026-10-09T05:00:00Z')
    const r = worker.reserveSlot(undefined, id, now)
    rows.set(control, { slots: r.slots, paused: false })
    rows.set(key, { status: 'queued', scheduled_at: r.scheduled_at, notes: 'Verified fixture context', storage_path: `social-queue/${id}.jpg`, rights_confirmed: true, image_url: `https://storage.googleapis.com/test-bucket/social-queue/${id}.jpg` })
  }
  try {
    await t.test('preparation runs both agents but never Facebook; concurrent publishers send once', async () => {
      seed()
      await Promise.all([worker.processImageQueueItem(id), worker.processImageQueueItem(id)])
      assert.deepEqual(sent, ['ai', 'ai'])
      assert.equal(rows.get(key).status, 'scheduled')
      assert.equal(await worker.publishDueImage(id), 'not_due')
      now = rows.get(key).scheduled_at
      await Promise.all([worker.publishDueImage(id), worker.publishDueImage(id)])
      assert.equal(sent.filter(s => s === 'facebook').length, 1)
      assert.equal(rows.get(key).status, 'posted')
    })
    await t.test('rejection holds without Facebook after two review rounds', async () => {
      seed(); verdict = false
      assert.equal(await worker.processImageQueueItem(id), 'needs_review')
      assert.deepEqual(sent, ['ai', 'ai', 'ai', 'ai'])
    })
    await t.test('budget and pause block inference', async () => {
      seed(); rows.set('automation_budgets/social-images-2026-10', { reserved_cents: 500 })
      await worker.processImageQueueItem(id)
      assert.equal(rows.get(key).status, 'queued'); assert.equal(sent.length, 0)
      seed(); rows.get(control).paused = true
      await worker.processImageQueueItem(id); assert.equal(sent.length, 0)
    })
    await t.test('paused, missing ownership or expired slot never publishes', async () => {
      seed(); await worker.processImageQueueItem(id); now = rows.get(key).scheduled_at
      rows.get(control).paused = true; assert.equal(await worker.publishDueImage(id), 'not_due')
      rows.get(control).paused = false; rows.get(control).slots = {}; assert.equal(await worker.publishDueImage(id), 'not_due')
      rows.get(control).slots[String(now)] = id; now += 30 * 60000; assert.equal(await worker.publishDueImage(id), 'not_due')
      assert.equal(sent.includes('facebook'), false)
    })
    await t.test('uncertain publication cannot automatically retry', async () => {
      seed(); await worker.processImageQueueItem(id); now = rows.get(key).scheduled_at; failFacebook = true
      assert.equal(await worker.publishDueImage(id), 'publish_uncertain')
      assert.equal(await worker.publishDueImage(id), 'not_due')
      assert.equal(sent.filter(s => s === 'facebook').length, 1)
    })
  } finally {
    Date.now = oldNow
    for (const key of ['SOCIAL_IMAGE_QUEUE_ENABLED', 'OPENAI_API_KEY', 'FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'MEDIA_BUCKET']) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key] }
    delete (globalThis as any).__socialQueueTest
  }
})
