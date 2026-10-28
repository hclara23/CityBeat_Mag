import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countArticles, selectArticles, type Article } from './articles'

// ---------------------------------------------------------------------------
// Reachability. 91 of 258 published stories could be reached from no page on
// the site: /stories and every topic page took the newest 60 and offered no
// second page, no archive and no related links. All 91 were `news`, the newest
// orphan published 2026-09-04. Their only trace anywhere was a sitemap entry —
// the weakest discovery signal Google has — and at roughly four briefs a day the
// orphan set grew by three or four stories daily.
// ---------------------------------------------------------------------------

const sample: Article = {
  _id: 'seed',
  slug: 'seed',
  title: 'Seed',
  titleES: 'Semilla',
  excerpt: 'x',
  excerptES: 'x',
  category: 'news',
  author: 'CityBeat',
  image: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  contentEN: '',
  contentES: '',
  status: 'published',
  sourceName: null,
  sourceUrl: null,
  imageCredit: null,
  imageCreditUrl: null,
  imageIllustrative: false,
}
const many = (n: number, category = 'news') =>
  Array.from({ length: n }, (_, i) => ({ ...sample, _id: `a${i}`, slug: `s${i}`, category }))

test('paging reaches every story, with no gaps and no repeats', () => {
  const all = many(258)
  const pageSize = 30
  const seen: string[] = []
  for (let page = 1; page <= Math.ceil(all.length / pageSize); page++) {
    seen.push(...selectArticles(all, { limit: pageSize, offset: (page - 1) * pageSize }).map((a) => a.slug))
  }
  assert.equal(seen.length, 258, 'every story must appear')
  assert.equal(new Set(seen).size, 258, 'no story may appear twice')
  assert.deepEqual(seen, all.map((a) => a.slug), 'order must hold across page boundaries')
})

test('an offset past the end yields nothing rather than wrapping around', () => {
  assert.deepEqual(selectArticles(many(5), { limit: 30, offset: 100 }), [])
})

test('a negative or fractional offset cannot shift the window', () => {
  // ?page= comes from the URL, so these are reachable by hand-typing.
  assert.deepEqual(selectArticles(many(5), { limit: 2, offset: -10 }).map((a) => a.slug), ['s0', 's1'])
  assert.deepEqual(selectArticles(many(5), { limit: 2, offset: 1.9 }).map((a) => a.slug), ['s1', 's2'])
})

test('paging still returns copies, so a caller cannot corrupt the shared cache', () => {
  // selectArticles operates on the cached array itself; this is the invariant
  // its own doc comment states, now also exercised through the offset path.
  const all = many(3)
  const got = selectArticles(all, { limit: 1, offset: 1 })
  got[0].title = 'mutated'
  assert.equal(all[1].title, 'Seed')
})

test('counts are per category, which is what drives the page count', () => {
  const all = [...many(2, 'news'), ...many(1, 'culture')]
  assert.equal(countArticles(all), 3)
  assert.equal(countArticles(all, 'news'), 2)
  assert.equal(countArticles(all, 'culture'), 1)
  // /sports is a published, crawlable page with nothing behind it; a zero count
  // must render as one empty page, never as a negative or infinite page count.
  assert.equal(countArticles(all, 'sports'), 0)
  assert.equal(Math.max(1, Math.ceil(countArticles(all, 'sports') / 30)), 1)
  assert.equal(countArticles(all, 'all'), 3, "'all' is not a category filter")
})
