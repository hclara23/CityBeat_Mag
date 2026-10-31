import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { FieldValue } from 'firebase-admin/firestore'
import { trackListingRequest, internalListingVisitor, validTrackingListingId, type TrackingDependencies, type ClientListingEvent } from './listing-tracking'
import { recordListingAction, recordQuoteWithStats } from './listing-tracking-store'
import { sendListingAction, createListingViewRecorder } from './listing-tracking-client'

type Write = { path: string; data: Record<string, any>; options?: unknown }
function memoryStore() {
  const writes: Write[] = []
  let fail = false
  let release: Promise<void> = Promise.resolve()
  const db = {
    collection: (collection: string) => ({ doc: (id = 'quote_generated') => ({
      id, path: `${collection}/${id}`,
      set: async (data: Record<string, unknown>, options: unknown) => {
        await release
        if (fail) throw new Error('storage unavailable')
        writes.push({ path: `${collection}/${id}`, data, options })
      },
    }) }),
    batch: () => {
      const staged: Write[] = []
      return {
        set: (ref: { path: string }, data: Record<string, unknown>, options?: unknown) => staged.push({ path: ref.path, data, options }),
        commit: async () => {
          await release
          if (fail) throw new Error('storage unavailable')
          writes.push(...staged)
        },
      }
    },
  }
  return { db: db as unknown as Parameters<typeof recordQuoteWithStats>[0], writes,
    fail: () => { fail = true }, wait: (promise: Promise<void>) => { release = promise } }
}

const now = new Date('2026-10-22T00:00:01Z')
function dependencies(store: ReturnType<typeof memoryStore>): TrackingDependencies {
  return {
    allowed: async () => true,
    listing: async () => ({ owner_id: 'owner', manager_ids: ['manager'] }),
    visitor: async () => null,
    record: (id, type, campaign) => recordListingAction(store.db, id, type, now, campaign),
    failure: () => {},
  }
}

for (const type of ['click_phone', 'click_website', 'click_directions_google', 'click_directions_apple', 'click_directions_location'] as ClientListingEvent[]) {
  test(`${type}: client transport through server records exactly one action`, async () => {
    const store = memoryStore()
    let completed: Promise<unknown> = Promise.resolve()
    let requests = 0
    const transport: typeof fetch = async (url, init) => {
      assert.equal(url, '/api/track/listing')
      assert.equal(init?.keepalive, true)
      requests++
      const result = await trackListingRequest(JSON.parse(String(init?.body)), dependencies(store))
      assert.equal(result.status, 200)
      return new Response(JSON.stringify(result.body), { status: result.status })
    }
    sendListingAction('paid_listing', type, () => { throw new Error('GA blocked') }, (url, init) => {
      const request = transport(url, init); completed = request; return request
    })
    await completed
    assert.equal(requests, 1)
    assert.equal(store.writes.length, 1)
    const write = store.writes[0]
    assert.equal(write.path, 'listing_stats/paid_listing_2026-10-22')
    assert.ok(write.data[type].isEqual(FieldValue.increment(1)))
    if (type.startsWith('click_directions_')) assert.ok(write.data.click_directions.isEqual(FieldValue.increment(1)))
    assert.equal(write.data.lead, undefined)
    assert.equal(write.data.click_phone, type === 'click_phone' ? write.data[type] : undefined)
  })
}

test('missing listings, rate limits and invalid client lead events never count', async () => {
  const store = memoryStore(); const deps = dependencies(store)
  for (const body of [null, { listingId: 'bad/path', type: 'click_phone' }, { listingId: 'a'.repeat(121), type: 'click_phone' }, { listingId: 'ok', type: 'lead' }, { listingId: 'ok', type: 'invalid' }]) {
    assert.equal((await trackListingRequest(body, deps)).status, 400)
  }
  assert.equal((await trackListingRequest({ listingId: 'ok', type: 'click_phone' }, { ...deps, listing: async () => null })).status, 404)
  assert.equal((await trackListingRequest({ listingId: 'ok', type: 'click_phone' }, { ...deps, allowed: async () => false })).status, 429)
  assert.equal(store.writes.length, 0)
})

test('lookup and visitor resolution failures remain observable without counting', async () => {
  for (const stage of ['listing', 'visitor'] as const) {
    const store = memoryStore(); let errors = 0
    const result = await trackListingRequest({ listingId: 'ok', type: 'click_phone' }, {
      ...dependencies(store), [stage]: async () => { throw new Error('unavailable') }, failure: () => { errors++ },
    })
    assert.equal(result.status, 503); assert.equal(errors, 1); assert.equal(store.writes.length, 0)
  }
})

test('owner, manager and staff self-traffic is excluded without counting', async () => {
  for (const visitor of [{ id: 'owner' }, { id: 'manager' }, { id: 'staff', profile: { role: 'editor' } }]) {
    const store = memoryStore()
    const result = await trackListingRequest({ listingId: 'ok', type: 'click_website' }, { ...dependencies(store), visitor: async () => visitor })
    assert.equal(result.body.excluded, true)
    assert.equal(store.writes.length, 0)
    assert.equal(internalListingVisitor({ owner_id: 'owner', manager_ids: ['manager'] }, visitor.id, visitor.profile), true)
  }
})

test('QR visits increment the existing view record once; invalid campaigns and action spoofing are ignored', async () => {
  const store=memoryStore()
  await trackListingRequest({listingId:'ok',type:'view',qrCampaign:'social-card'},dependencies(store))
  assert.equal(store.writes.length,1)
  assert.deepEqual(store.writes[0].data.view,FieldValue.increment(1))
  assert.deepEqual(store.writes[0].data.qr_visit,FieldValue.increment(1))
  assert.deepEqual(store.writes[0].data.qr_social_card,FieldValue.increment(1))
  await trackListingRequest({listingId:'ok',type:'click_phone',qrCampaign:'listing'},dependencies(store))
  await trackListingRequest({listingId:'ok',type:'view',qrCampaign:'arbitrary'},dependencies(store))
  assert.equal(store.writes[1].data.qr_visit,undefined)
  assert.equal(store.writes[2].data.qr_visit,undefined)
})

test('failed writes are observable failures and are never retried', async () => {
  const store = memoryStore(); store.fail(); let errors = 0; let writes = 0
  const deps = dependencies(store)
  const result = await trackListingRequest({ listingId: 'ok', type: 'click_phone' }, {
    ...deps, record: async (...args) => { writes++; await deps.record(...args) }, failure: () => { errors++ },
  })
  assert.equal(result.status, 503)
  assert.equal(result.body.ok, false)
  assert.equal(errors, 1); assert.equal(writes, 1); assert.equal(store.writes.length, 0)
})

test('long valid listing IDs are preserved rather than truncated', async () => {
  const store = memoryStore(); const id = 'sf:' + 'a'.repeat(100)
  assert.equal((await trackListingRequest({ listingId: id, type: 'click_phone' }, dependencies(store))).status, 200)
  assert.equal(store.writes[0].path, `listing_stats/${id}_2026-10-22`)
})

test('metadata refresh and effect replay do not inflate views', () => {
  const record = createListingViewRecorder(); let views = 0
  record('a', undefined, () => views++)
  record('a', 'a', () => views++)
  record('a', 'a', () => views++)
  record('b', 'a', () => views++)
  record('b', 'b', () => views++)
  assert.equal(views, 2)
})

test('quote and genuine lead increment commit together before success', async () => {
  const store = memoryStore(); let release!: () => void; let returned = false
  store.wait(new Promise<void>(resolve => { release = resolve }))
  const pending = recordQuoteWithStats(store.db, 'paid_listing', { status: 'new' }, true, now).then(id => { returned = true; return id })
  await Promise.resolve()
  assert.equal(returned, false); assert.equal(store.writes.length, 0)
  release(); assert.equal(await pending, 'quote_generated')
  assert.equal(store.writes.length, 2)
  assert.equal(store.writes[1].path, 'listing_stats/paid_listing_2026-10-22')
  assert.ok(store.writes[1].data.lead.isEqual(FieldValue.increment(1)))
})

test('failed atomic quote commit leaves neither a quote nor an inflated lead', async () => {
  const store = memoryStore(); store.fail()
  await assert.rejects(recordQuoteWithStats(store.db, 'paid_listing', { status: 'new' }, true, now), /storage unavailable/)
  assert.equal(store.writes.length, 0)
})

test('spam and self-submissions are stored without counting customer leads', async () => {
  for (const data of [{ status: 'spam' }, { status: 'new', analytics_excluded: true }]) {
    const store = memoryStore()
    await recordQuoteWithStats(store.db, 'paid_listing', data, false, now)
    assert.equal(store.writes.length, 1)
    assert.equal(store.writes[0].path, 'quote_requests/quote_generated')
  }
})

test('transport errors never break link behavior or trigger duplicate retries', async () => {
  let attempts = 0
  const fetchFailure = (() => { attempts++; throw new Error('unavailable') }) as typeof fetch
  assert.doesNotThrow(() => sendListingAction('a', 'click_phone', () => {}, fetchFailure))
  assert.equal(attempts, 1)
})

// Execute the actual quote HTTP handler in an isolated module context. Every
// cloud/auth/AI/email dependency is replaced; unexpected imports fail closed.
function quoteHandler(options: { spam?: boolean; self?: boolean; failedWrite?: boolean; missingListing?: boolean } = {}) {
  const store = memoryStore()
  if (options.failedWrite) store.fail()
  let notifications = 0
  const db = {
    ...store.db,
    collection: (name: string) => ({ doc: (id?: string) => ({
      ...store.db.collection(name).doc(id!),
      get: async () => ({ exists: !options.missingListing, data: () => ({ owner_id: 'owner', claim_status: 'approved', tier: 'premium' }) }),
    }) }),
  }
  const mocks: Record<string, unknown> = {
    'next/server': { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } },
    '@citybeat/lib/firebase/admin': { adminDb: db },
    '@citybeat/lib/firebase/server': { getServerUser: async () => options.self ? { id: 'owner' } : null, getServerUserProfile: async () => null },
    '@/lib/listing-tracking': { internalListingVisitor, validTrackingListingId },
    '@/lib/listing-tracking-store': { recordQuoteWithStats },
    'firebase-admin/firestore': { FieldValue },
    '@/lib/auth-security': { getClientIp: () => 'test', checkRateLimit: async () => ({ ok: true }) },
    '@/lib/email': { sendEmail: async () => { notifications++; return { sent: true } } },
    '@/lib/user-notifications': { notifyUser: async () => { notifications++ } },
    '@/lib/unclaimed-relay': { sendUnclaimedRelay: async () => { notifications++ } },
    '@/lib/jev': { genuineProbability: async () => options.spam ? 0 : 1, isJevSpam: (value: number) => value === 0 },
  }
  const output = ts.transpileModule(readFileSync(new URL('../app/api/leads/quote/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports: { POST?: (request: Request) => Promise<Response> } = {}
  runInNewContext(output, {
    exports, process: { env: {} }, console: { error: () => {} },
    require: (id: string) => { if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`); return mocks[id] },
  })
  return { store, notifications: () => notifications, post: (body: unknown) => exports.POST!(new Request('https://test.invalid/api/leads/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })) }
}

test('actual quote route records a genuine submission and exactly one lead', async () => {
  const handler = quoteHandler()
  const response = await handler.post({ listingId: 'paid_listing', name: 'Test', contact: 'test@example.invalid', message: 'Test only' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'recorded')
  assert.equal(handler.store.writes.filter(x => x.path.startsWith('listing_stats/')).length, 1)
  assert.equal(handler.notifications(), 1)
})

test('actual quote route does not count malformed, missing, spam or self requests', async () => {
  for (const body of [null, {}, { listingId: 'x'.repeat(121), name: 'Test', contact: 'test@example.invalid' }]) {
    const handler = quoteHandler(); assert.equal((await handler.post(body)).status, 400)
    assert.equal(handler.store.writes.length, 0); assert.equal(handler.notifications(), 0)
  }
  for (const options of [{ missingListing: true }, { spam: true }, { self: true }]) {
    const handler = quoteHandler(options)
    const response = await handler.post({ listingId: 'paid_listing', name: 'Test', contact: 'test@example.invalid' })
    assert.equal(response.status, options.missingListing ? 404 : 200)
    assert.equal(handler.store.writes.filter(x => x.path.startsWith('listing_stats/')).length, 0)
    if (!('self' in options)) assert.equal(handler.notifications(), 0)
  }
})

test('actual quote route fails without notification or partial analytics on storage failure', async () => {
  const handler = quoteHandler({ failedWrite: true })
  const response = await handler.post({ listingId: 'paid_listing', name: 'Test', contact: 'test@example.invalid' })
  assert.equal(response.status, 500)
  assert.equal(handler.store.writes.length, 0)
  assert.equal(handler.notifications(), 0)
})
