import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import { NextRequest } from 'next/server'

// cron-dry-run.test.ts proves every cron route READS ?dryRun=1. This proves the
// ones that used to ignore it now do what a preview must: report, and change
// nothing. Each test runs the preview first and the real thing second against the
// same fixture, because a preview that does nothing at all would pass the first
// half on its own.

type Modules = Record<string, string>

async function load(entry: string, fixture: unknown, modules: Modules) {
  ;(globalThis as any).__cronDryRun = fixture
  const bundled = await build({
    entryPoints: [path.resolve(entry)], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external',
    plugins: [{ name: 'offline-only', setup(b) {
      b.onResolve({ filter: /^(@citybeat\/|@\/|\.\/)/ }, (a) => {
        if (!modules[a.path]) throw new Error(`Unmocked dependency: ${a.path}`)
        return { path: a.path, namespace: 'fixture' }
      })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ loader: 'js', contents: `const f=globalThis.__cronDryRun; ${modules[a.path]}` }))
    } }],
  })
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), mod, mod.exports)
  return mod.exports
}

const call = (handler: (r: NextRequest) => Promise<Response>, query = '') =>
  handler(new NextRequest(`https://example.test/api/cron/x${query}`, { headers: { authorization: 'Bearer dry-run-test' } }))

async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const before: Record<string, string | undefined> = {}
  for (const k of ['CRON_SECRET', ...Object.keys(env)]) before[k] = process.env[k]
  process.env.CRON_SECRET = 'dry-run-test'
  Object.assign(process.env, env)
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    delete (globalThis as any).__cronDryRun
  }
}

test('social: a preview lists what it would post and posts nothing', async () => {
  await withEnv({}, async () => {
    const posted: string[] = [], added: string[] = [], stamped: string[] = [], drained: number[] = []
    // Distinct times: the route posts newest first, and two stamps taken in the
    // same millisecond would leave the order to the sort.
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
    const fixture = {
      db: { collection: () => ({
        where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }),
        add: async (d: any) => { added.push(d.slug) },
      }) },
      stamp: async (s: string) => { stamped.push(s) },
      noop: async () => undefined,
      articles: async () => [{ slug: 'a', title: 'A', publishedAt: hoursAgo(1) }, { slug: 'b', title: 'B', publishedAt: hoursAgo(2) }],
      post: async (a: any) => { posted.push(a.slug); return [{ network: 'facebook', status: 'posted' }] },
      postWeekend: async () => { posted.push('weekend'); return [{ network: 'facebook', status: 'posted' }] },
      weekendEvents: async () => ({ events: [{ title_en: 'Show' }], label: 'this weekend' }),
      drain: async () => { drained.push(1); return { enabled: true } },
    }
    const mod = await load('src/app/api/cron/social/route.ts', fixture, {
      '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
      '@/lib/articles': 'export const getPublishedArticles=f.articles',
      '@/lib/social': 'export const postArticleToSocial=f.post, postThisWeekendToSocial=f.postWeekend, socialConfigured=()=>true',
      '@/lib/events': 'export const getThisWeekendEvents=f.weekendEvents',
      '@/lib/alerts': 'export const reportSuccess=f.stamp, reportFailure=f.noop, reportCronAuthRejected=f.noop',
      '@/lib/social-queue': 'export const drainImageQueue=f.drain',
      '@/lib/social-schedule': 'export const slotParts=()=>({hour:3,minute:30})',
    })

    const preview = await (await call(mod.GET, '?dryRun=1&weekend=1')).json()
    assert.equal(preview.dryRun, true)
    assert.deepEqual(preview.results, [{ slug: 'a', would_post: true }, { slug: 'b', would_post: true }])
    assert.deepEqual(preview.weekend, { would_post: true, events: 1 })
    assert.deepEqual(posted, [], 'a preview never posts to Facebook')
    assert.deepEqual(added, [], 'and never burns a story\'s dedupe slot')
    assert.deepEqual(drained, [], 'and never drains the image queue, which publishes')
    assert.deepEqual(stamped, [], 'and is not evidence that the scheduler ran')

    const real = await (await call(mod.GET, '?weekend=1')).json()
    assert.equal(real.posted, 2)
    assert.deepEqual(posted, ['a', 'b', 'weekend'])
    assert.equal(drained.length, 1)
    assert.deepEqual(stamped, ['cron:social'])
  })
})

test('sync-events: a preview counts the purge and the upserts and deletes and writes nothing', async () => {
  await withEnv({ TICKETMASTER_API_KEY: 'test-key' }, async () => {
    const deleted: string[] = [], written: string[] = [], stamped: string[] = []
    const row = (label: string, startDate?: string) => ({ ref: { delete: async () => { deleted.push(label) } }, data: () => ({ start_date: startDate }) })
    const fixture = {
      db: { collection: () => ({
        where: (_f: string, _o: string, source: string) => ({ get: async () => ({
          docs: source === 'sync'
            ? [row('mock')]
            : [row('past', '2020-01-01T00:00:00.000Z'), row('future', new Date(Date.now() + 5 * 86400000).toISOString())],
        }) }),
        doc: (id: string) => ({ set: async () => { written.push(id) } }),
      }) },
      stamp: async (s: string) => { stamped.push(s) },
      noop: async () => undefined,
      events: async () => [{ external_id: '1', title: 'A' }, { external_id: '2', title: 'B' }],
    }
    const mod = await load('src/app/api/cron/sync-events/route.ts', fixture, {
      '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
      '@/lib/events-scraper': 'export const fetchTicketmasterEvents=f.events',
      '@/lib/alerts': 'export const reportSuccess=f.stamp, reportFailure=f.noop, reportCronAuthRejected=f.noop',
    })

    const preview = await (await call(mod.GET, '?dryRun=1')).json()
    assert.equal(preview.dryRun, true)
    assert.equal(preview.purged_mock, 1)
    assert.equal(preview.purged_past, 1)
    assert.equal(preview.upserted, 2)
    assert.deepEqual(deleted, [], 'a preview deletes no event rows')
    assert.deepEqual(written, [], 'and upserts none')
    assert.deepEqual(stamped, [])

    await call(mod.GET)
    assert.deepEqual(deleted, ['mock', 'past'], 'the real run purges the legacy mock and the past event, never the future one')
    assert.deepEqual(written, ['tm-1', 'tm-2'])
    assert.deepEqual(stamped, ['cron:sync-events'])
  })
})

test('translate-listings: a preview counts the backlog without spending a translation or writing', async () => {
  await withEnv({}, async () => {
    const translated: number[] = [], written: string[] = [], stamped: string[] = []
    const listing = (id: string) => ({ id, data: () => ({ description: `About ${id}`, description_es: '' }) })
    const fixture = {
      db: { collection: (name: string) => ({
        where: () => ({ get: async () => ({ forEach: (fn: (d: any) => void) => [listing('L1'), listing('L2')].forEach(fn) }) }),
        limit: () => ({ get: async () => ({ docs: [{ ref: { set: async () => { written.push('article') } }, data: () => ({ title: 'T', content: 'English body' }) }] }) }),
        doc: (id: string) => ({ set: async () => { written.push(`${name}/${id}`) } }),
      }) },
      stamp: async (s: string) => { stamped.push(s) },
      noop: async () => undefined,
      translate: async (texts: string[]) => { translated.push(texts.length); return texts.map((t) => `ES ${t}`) },
      translateArticle: async () => { translated.push(1) },
    }
    const mod = await load('src/app/api/cron/translate-listings/route.ts', fixture, {
      '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
      '@/lib/translate': 'export const translateTexts=f.translate, translateArticleToEs=f.translateArticle',
      '@/lib/alerts': 'export const reportSuccess=f.stamp, reportFailure=f.noop, reportCronAuthRejected=f.noop',
    })

    const preview = await (await call(mod.GET, '?dryRun=1')).json()
    assert.equal(preview.dryRun, true)
    assert.equal(preview.would_translate, 2)
    assert.deepEqual(translated, [], 'a preview makes no translation call (DeepL quota or Anthropic tokens)')
    assert.deepEqual(written, [])
    assert.deepEqual(stamped, [])

    const articles = await (await call(mod.GET, '?dryRun=1&articles=1')).json()
    assert.equal(articles.repaired, 1, 'the article backfill previews too')
    assert.deepEqual(translated, [])
    assert.deepEqual(written, [])

    const real = await (await call(mod.GET)).json()
    assert.equal(real.translated, 2)
    assert.deepEqual(translated, [2])
    assert.deepEqual(written, ['directory_listings/L1', 'directory_listings/L2'])
    assert.deepEqual(stamped, ['cron:translate-listings'])
  })
})

test('directory-ingest: a preview fetches candidates but is told not to write', async () => {
  await withEnv({}, async () => {
    const writes: boolean[] = [], stamped: string[] = [], failures: string[] = []
    const fixture = {
      ingest: async (o: any) => {
        writes.push(Boolean(o.write))
        return { candidates: [{}], inserted: o.write ? 1 : 0, swept: ['Real Estate'], skipped: [], failed: [{ category: 'Attorneys', reason: 'down' }], budgetExhausted: false }
      },
      stamp: async (s: string) => { stamped.push(s) },
      fail: async (s: string) => { failures.push(s) },
      noop: async () => undefined,
    }
    const mod = await load('src/app/api/cron/directory-ingest/route.ts', fixture, {
      '@citybeat/lib/directory/ingest': 'export const runDirectoryIngest=f.ingest, sweptButFoundNothing=()=>false',
      '@/lib/alerts': 'export const reportSuccess=f.stamp, reportFailure=f.fail, reportCronAuthRejected=f.noop',
    })

    const preview = await (await call(mod.GET, '?dryRun=1')).json()
    assert.equal(preview.dry_run, true)
    assert.equal(preview.inserted, 0)
    assert.deepEqual(writes, [false])
    assert.deepEqual(stamped, [])
    assert.deepEqual(failures, [], 'a preview does not page anyone about a category that failed')

    await call(mod.GET)
    assert.deepEqual(writes, [false, true])
    assert.deepEqual(stamped, ['cron:directory-ingest'])
    assert.deepEqual(failures, ['cron:directory-ingest'], 'the real run still reports the failed category')
  })
})

test('enrich-contacts: a preview finds the emails but stores none, stamps none and does not move its cursor', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('<a href="mailto:owner@acme-plumbing.test">Email us</a>')) as typeof fetch
  try {
    await withEnv({}, async () => {
      const writes: Array<Record<string, any>> = [], cursorSets: Array<string | null> = []
      const fixture = {
        db: { collection: () => {
          const q: any = {
            where: () => q, orderBy: () => q, limit: () => q, startAfter: () => q,
            get: async () => ({
              empty: false,
              size: 1,
              docs: [{ id: 'E1', ref: { set: async (u: Record<string, unknown>) => { writes.push(u) } }, data: () => ({ website: 'https://acme-plumbing.test', created_at: '2026-01-01T00:00:00.000Z' }) }],
            }),
            doc: () => ({}),
          }
          return q
        } },
        getCursor: async () => null,
        setCursor: async (_name: string, value: string | null) => { cursorSets.push(value) },
      }
      const lib = await load('src/lib/enrich-contacts.ts', fixture, {
        '@citybeat/lib/firebase/admin': 'export const adminDb=f.db',
        './cron-cursor': 'export const getCronCursor=f.getCursor, setCronCursor=f.setCursor',
        './listing-cursor': 'export const decodeListingCursor=()=>null, encodeListingCursor=()=>"next-page"',
      })

      const preview = await lib.runContactEnrichment({ limit: 5, dryRun: true })
      assert.equal(preview.dry_run, true)
      assert.equal(preview.emails_found, 1, 'the preview still reads the site, so it can say what a real run would find')
      assert.equal(preview.updated, 1)
      assert.equal(writes.length, 0, 'no email onto the listing and no enrich_attempted_at stamp')
      assert.deepEqual(cursorSets, [], 'the persisted cursor stays put, so the real run starts where the preview did')

      const real = await lib.runContactEnrichment({ limit: 5 })
      assert.equal(real.updated, 1)
      assert.equal(writes.length, 1)
      assert.equal(writes[0].email, 'owner@acme-plumbing.test')
      assert.ok(writes[0].enrich_attempted_at)
      assert.equal(cursorSets.length, 1)
    })
  } finally {
    globalThis.fetch = realFetch
  }
})
