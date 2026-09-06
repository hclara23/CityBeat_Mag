import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARTICLE_LIST_FIELDS, selectArticles, type Article } from './articles'

function article(over: Partial<Article> = {}): Article {
  return {
    _id: 'a1',
    slug: 'a1',
    title: 'A',
    titleES: 'A',
    excerpt: '',
    excerptES: '',
    category: 'news',
    author: 'CityBeat',
    image: null,
    publishedAt: '2026-09-01T00:00:00.000Z',
    contentEN: '',
    contentES: '',
    status: 'published',
    sourceName: null,
    sourceUrl: null,
    imageCredit: null,
    imageCreditUrl: null,
    imageIllustrative: false,
    ...over,
  }
}

test('the list projection never asks Firestore for the article bodies', () => {
  // The regression this pins: the homepage read every published article WITH
  // both full TipTap bodies and flattened them to text, to sort and keep 3. If
  // `content` or `content_es` is ever added back to the projection, ~23MB of
  // bilingual article bodies is back on every homepage render.
  assert.ok(!ARTICLE_LIST_FIELDS.includes('content'))
  assert.ok(!ARTICLE_LIST_FIELDS.includes('content_es'))
  // Everything the card and the sort actually need must still be projected.
  for (const field of ['slug', 'title', 'title_es', 'excerpt', 'excerpt_es', 'published_at', 'status']) {
    assert.ok(ARTICLE_LIST_FIELDS.includes(field), `missing projected field: ${field}`)
  }
})

test('selectArticles filters by category, and "all" means every category', () => {
  const all = [
    article({ _id: 'n', category: 'news' }),
    article({ _id: 'b', category: 'business' }),
    article({ _id: 'c', category: 'culture' }),
  ]
  assert.deepEqual(selectArticles(all, { category: 'business' }).map((a) => a._id), ['b'])
  assert.equal(selectArticles(all, { category: 'all' }).length, 3)
  assert.equal(selectArticles(all).length, 3)
  assert.equal(selectArticles(all, { category: 'nope' }).length, 0)
})

test('the limit applies after the category filter, not before it', () => {
  // Slicing first would hand /topics/culture an empty page whenever the three
  // newest stories happened to be news.
  const all = [
    article({ _id: 'n1', category: 'news' }),
    article({ _id: 'n2', category: 'news' }),
    article({ _id: 'c1', category: 'culture' }),
  ]
  assert.deepEqual(selectArticles(all, { category: 'culture', limit: 2 }).map((a) => a._id), ['c1'])
  assert.deepEqual(selectArticles(all, { limit: 2 }).map((a) => a._id), ['n1', 'n2'])
})

test('selectArticles hands back copies, never the shared cached array or its rows', () => {
  // The list is now cached per process and reused by every request on the
  // instance. A caller that sorted the returned array in place, or edited a row
  // it got back, would corrupt the homepage for everyone else on that instance
  // until the TTL lapsed — so nothing returned here may alias the cache.
  const cached = [article({ _id: 'x' }), article({ _id: 'y' })]
  const out = selectArticles(cached)
  assert.notEqual(out, cached)
  assert.notEqual(out[0], cached[0])
  out.reverse()
  out[0].title = 'mutated'
  assert.deepEqual(cached.map((a) => a._id), ['x', 'y'])
  assert.equal(cached[0].title, 'A')
  assert.equal(cached[1].title, 'A')
})
