import { adminDb } from '@citybeat/lib/firebase/admin'
import { localArticles, type LocalArticle } from './localArticles'

// Normalized public article shape used by all public content pages.
// Sourced from the Firestore `articles` collection (written by the creator/admin
// dashboards) and merged with the bundled `localArticles` seed content.
export type Article = {
  _id: string
  slug: string
  title: string
  titleES: string
  excerpt: string
  excerptES: string
  category: string // slug: news | business | events | culture
  author: string
  image: string | null
  publishedAt: string
  contentEN: string
  contentES: string
  status: string
  // Attribution for briefs re-reported from another outlet (autonomous newsroom).
  sourceName: string | null
  sourceUrl: string | null
  // Image attribution (CC-licensed illustrative photo via Openverse).
  imageCredit: string | null
  imageCreditUrl: string | null
  imageIllustrative: boolean
}

export const CATEGORY_IDS = ['news', 'business', 'events', 'culture'] as const

// Article `content` may be either a flat block array
// ([{ type:'paragraph', content:[{ text }] }]) or a TipTap/ProseMirror document
// object ({ type:'doc', content:[...] }) produced by the rich text editor.
// Walk either shape and flatten to plain text with paragraph breaks.
const INLINE_CONTAINERS = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'])

function blocksToText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((n) => blocksToText(n)).filter(Boolean).join('\n\n')
  }
  const node = content as any
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (Array.isArray(node.content)) {
    // Inline containers keep their text on one line; block containers (doc,
    // lists, …) separate their children with blank lines.
    const sep = INLINE_CONTAINERS.has(node.type) ? '' : '\n\n'
    return node.content.map((n: any) => blocksToText(n)).filter(Boolean).join(sep)
  }
  return node.text ?? ''
}

type Lookups = { catMap: Map<string, string>; authorMap: Map<string, string> }

// `categories` and `authors` are small, near-static lookup tables that were
// re-read IN FULL on every single article read — two extra whole-collection
// reads on every homepage render and on every /stories/[slug] hit. Cached per
// process; a newly created category or author becomes visible within the TTL.
const LOOKUP_TTL_MS = 5 * 60 * 1000
let lookupCache: { at: number; value: Lookups } | null = null
let lookupInFlight: Promise<Lookups> | null = null

async function fetchLookups(): Promise<Lookups> {
  const [cats, authors] = await Promise.all([
    adminDb.collection('categories').get(),
    adminDb.collection('authors').get(),
  ])
  const catMap = new Map<string, string>()
  cats.forEach((d) => {
    const v = d.data() as any
    catMap.set(d.id, v.slug || v.name || 'news')
  })
  const authorMap = new Map<string, string>()
  authors.forEach((d) => {
    const v = d.data() as any
    authorMap.set(d.id, v.name || 'CityBeat')
  })
  return { catMap, authorMap }
}

async function loadLookups(): Promise<Lookups> {
  if (lookupCache && Date.now() - lookupCache.at < LOOKUP_TTL_MS) return lookupCache.value
  // Single in-flight read: the TTL expires for every concurrent request at the
  // same instant, so without this a burst re-read both collections once per
  // request instead of once per window.
  if (!lookupInFlight) {
    lookupInFlight = fetchLookups()
      .then((value) => {
        lookupCache = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        lookupInFlight = null
      })
  }
  // A stale lookup table only mislabels a brand-new category/author; a failed
  // read must not take the article list down with it.
  if (lookupCache) return lookupCache.value
  return lookupInFlight
}

// `flattenBody: false` is the LIST shape: the row arrived from the ARTICLE_LIST_FIELDS
// projection, so `content` / `content_es` are not present at all and there is
// nothing to walk. Only the two single-document detail readers flatten, and they
// read exactly one document each.
function normalizeFirestore(
  id: string,
  a: any,
  catMap: Map<string, string>,
  authorMap: Map<string, string>,
  opts: { flattenBody?: boolean } = {}
): Article {
  const flattenBody = opts.flattenBody !== false
  const text = flattenBody ? blocksToText(a.content) : ''
  // Spanish fields are populated by the translation pipeline; fall back to EN.
  const textEs = flattenBody ? (a.content_es ? blocksToText(a.content_es) : text) : ''
  const rawPublished = a.published_at?.toDate ? a.published_at.toDate().toISOString() : a.published_at
  const createdAt = a.created_at?.toDate ? a.created_at.toDate().toISOString() : a.created_at
  const publishedAt =
    (typeof rawPublished === 'string' && rawPublished) ||
    (typeof createdAt === 'string' && createdAt) ||
    new Date().toISOString()
  const title = a.title || 'Untitled'
  // A list row has no body to fall back to; backfillExcerpts() pays that read
  // for the handful of rows a caller actually renders.
  const excerpt = a.excerpt || text.slice(0, 160)
  return {
    _id: id,
    slug: a.slug || id,
    title,
    titleES: a.title_es || title,
    excerpt,
    excerptES: a.excerpt_es || excerpt,
    category: a.category_id ? catMap.get(a.category_id) || 'news' : a.category || 'news',
    author: a.author_id ? authorMap.get(a.author_id) || 'CityBeat' : a.author || 'CityBeat',
    image: a.image_url || a.cover_image_path || null,
    publishedAt,
    contentEN: text,
    contentES: textEs,
    status: a.status || 'published',
    sourceName: a.source_name || null,
    // Scheme-checked at the data layer so EVERY render of the credit link is
    // covered: the value arrives from external RSS, and a compromised feed
    // could plant a javascript: href behind "Original reporting: KVIA".
    sourceUrl:
      typeof a.source_url === 'string' && /^https?:\/\//.test(a.source_url) ? a.source_url : null,
    imageCredit: a.image_credit || null,
    imageCreditUrl: a.image_credit_url || null,
    imageIllustrative: Boolean(a.image_illustrative),
  }
}

function fromLocal(a: LocalArticle): Article {
  return {
    _id: a._id,
    slug: a.slug,
    title: a.title,
    titleES: a.title,
    excerpt: a.excerpt,
    excerptES: a.excerpt,
    category: a.category,
    author: a.author,
    image: a.image ?? null,
    publishedAt: a.publishedAt,
    contentEN: a.contentEN || a.content,
    contentES: a.contentES || a.content,
    status: 'published',
    sourceName: null,
    sourceUrl: null,
    imageCredit: null,
    imageCreditUrl: null,
    imageIllustrative: false,
  }
}

// ── The published-article list ──────────────────────────────────────────────
// Every homepage render used to `.get()` the WHOLE `articles` collection with no
// projection and no cache, run blocksToText over both bilingual bodies of every
// document, sort, and keep 3. The pages are force-dynamic, so no ISR or fetch
// cache absorbed any of it: N published articles cost N billed reads plus two
// whole-collection lookup reads per request, and at --concurrency=80 the
// container held eighty independent copies of every article body. At the
// newsroom's own rate (up to 8 briefs/day) N passes 2,900 inside a year.
//
// Two costs, two fixes:
//   • bytes and CPU — ARTICLE_LIST_FIELDS omits `content` / `content_es`, the only large
//     fields, so the TipTap bodies never leave Firestore for a list read.
//   • billed reads — the projected, sorted list is cached per process behind a
//     single in-flight promise, so a burst of renders costs one read set rather
//     than one per request. Firestore bills per document READ regardless of
//     projection (see api/directory/route.ts), so only the cache moves the bill.
export const ARTICLE_LIST_FIELDS: string[] = [
  'slug',
  'title',
  'title_es',
  'excerpt',
  'excerpt_es',
  'category',
  'category_id',
  'author',
  'author_id',
  'image_url',
  'cover_image_path',
  'published_at',
  'created_at',
  'status',
  'source_name',
  'source_url',
  'image_credit',
  'image_credit_url',
  'image_illustrative',
]

// Hard backstop so an unbounded collection can never OOM the container, in the
// spirit of CORPUS_MAX_DOCS in api/directory/route.ts. Well above current
// inventory.
//
// The query IS ordered now — the (status, published_at) composite index this
// needs is in firestore.indexes.json — so hitting the cap drops the OLDEST
// articles rather than an arbitrary doc-id-ordered subset. That is the
// difference between a truncated list that still shows today's news and one
// that shows a random slice of the archive.
const LIST_SCAN_CAP = 5000

// Every caller shares one cache, so the read cost is per cache MISS, not per
// request: articles_count x (3600 / TTL) x warm instances per hour, and
// Firestore bills per document read regardless of projection. At 60s that is 60
// full scans an hour per instance for a corpus that changes a few times a day.
//
// 3 minutes is the trade: an editor publishing an article waits up to that long
// to see it on the homepage, and the read bill drops threefold. A shorter TTL
// would be buying immediacy nobody asked for with the only cost that scales.
const LIST_TTL_MS = 3 * 60 * 1000
// Ceiling on the excerpt backfill below, sized to the largest limit any list
// caller passes (60, on /stories and /topics). Without it a caller that asks for
// no limit at all (the newsletter and social crons) could turn the backfill back
// into a whole-collection body read — the exact bug this file just removed.
const EXCERPT_BACKFILL_MAX = 60

let listCache: { at: number; rows: Article[] } | null = null
let listInFlight: Promise<Article[]> | null = null
// Excerpts derived from a body, for the rare row whose `excerpt` field is empty.
// Rebuilt with the list cache so it can never outlive the rows it describes.
let excerptMemo = new Map<string, string>()

const byPublishedDesc = (a: Article, b: Article) => (b.publishedAt > a.publishedAt ? 1 : -1)

async function fetchPublishedList(): Promise<Article[]> {
  const { catMap, authorMap } = await loadLookups()
  // Ordered at the database now, so the cap drops the oldest rather than an
  // arbitrary subset. The in-memory sort below stays: it is cheap over projected
  // rows and it is what keeps the result correct on the fallback path.
  //
  // Falls back to the unordered scan if the composite index is missing — the same
  // shape runPayoutCycle uses. An index that has not finished building must never
  // take the homepage down.
  const base = adminDb
    .collection('articles')
    .where('status', '==', 'published')
    .select(...ARTICLE_LIST_FIELDS)

  let snap
  try {
    snap = await base.orderBy('published_at', 'desc').limit(LIST_SCAN_CAP).get()
  } catch {
    snap = await base.limit(LIST_SCAN_CAP).get()
  }

  const rows = snap.docs.map((d) =>
    normalizeFirestore(d.id, d.data(), catMap, authorMap, { flattenBody: false })
  )
  // Firestore is the source of truth (the seed has been migrated into it). The
  // bundled seed is only a fallback for when Firestore returns nothing — e.g. the
  // migration hasn't run yet — so the site never goes empty.
  return (rows.length > 0 ? rows : localArticles.map(fromLocal)).sort(byPublishedDesc)
}

async function loadPublishedList(): Promise<Article[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.rows
  // Stampede guard: Cloud Run scales out and the TTL lapses for every in-flight
  // request at the same instant, so without this a burst of homepage renders
  // each issued its own full-collection read.
  if (!listInFlight) {
    listInFlight = fetchPublishedList()
      .then((rows) => {
        listCache = { at: Date.now(), rows }
        excerptMemo = new Map()
        return rows
      })
      .catch((error) => {
        console.error('getPublishedArticles firestore error:', error)
        // Prefer the last good list over the bundled seed: a transient Firestore
        // error must not swap the newsroom's current stories for 2024 seed copy.
        return listCache?.rows ?? localArticles.map(fromLocal).sort(byPublishedDesc)
      })
      .finally(() => {
        listInFlight = null
      })
  }
  return listInFlight
}

/**
 * Filter + limit over the SHARED cached array. Pure, and it copies at every
 * level: the array handed in is the cache itself, so a caller that sorted or
 * spliced it in place would corrupt every later request on the instance.
 */
export function selectArticles(
  all: Article[],
  opts: { category?: string; limit?: number } = {}
): Article[] {
  const filtered =
    opts.category && opts.category !== 'all' ? all.filter((a) => a.category === opts.category) : all
  const limited = opts.limit ? filtered.slice(0, opts.limit) : filtered
  return limited.map((a) => ({ ...a }))
}

// A projected list row has no body, so an article whose `excerpt` field is empty
// (the creator flow stores `excerpt: excerpt || ''`) would render a card with no
// summary line — it used to derive one from the body, which is precisely the
// whole-collection body read this change removes. Pay that read for just the
// rows the caller is about to render, and memoise it until the list is rebuilt.
async function backfillExcerpts(rows: Article[]): Promise<Article[]> {
  const missing = rows
    .filter((r) => !r.excerpt && !excerptMemo.has(r._id))
    .slice(0, EXCERPT_BACKFILL_MAX)
  if (missing.length > 0) {
    try {
      const refs = missing.map((r) => adminDb.collection('articles').doc(r._id))
      const docs = await adminDb.getAll(...refs, { fieldMask: ['content'] })
      docs.forEach((d, i) => {
        excerptMemo.set(missing[i]._id, blocksToText(d.data()?.content).slice(0, 160))
      })
    } catch (error) {
      // A card with no summary line is a much smaller failure than a 500.
      console.error('getPublishedArticles excerpt backfill error:', error)
    }
  }
  for (const row of rows) {
    if (row.excerpt) continue
    const derived = excerptMemo.get(row._id)
    if (!derived) continue
    row.excerpt = derived
    // Mirrors the old fallback chain: excerptES fell back to the EN excerpt,
    // which itself fell back to the body text.
    if (!row.excerptES) row.excerptES = derived
  }
  return rows
}

export async function getPublishedArticles(
  opts: { category?: string; limit?: number } = {}
): Promise<Article[]> {
  const all = await loadPublishedList()
  // selectArticles hands back copies, so mutating them here cannot touch the cache.
  return backfillExcerpts(selectArticles(all, opts))
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  // Firestore first (authoritative), then the bundled seed as a fallback.
  try {
    const { catMap, authorMap } = await loadLookups()
    const snap = await adminDb.collection('articles').where('slug', '==', slug).limit(1).get()
    if (!snap.empty) {
      const d = snap.docs[0]
      const raw = d.data() as any
      // The review gate must hold at RENDER time, not just in the lists:
      // without this, anyone with the direct URL could read pending, draft,
      // and even REJECTED articles in full. Missing status = legacy published.
      if (raw.status && raw.status !== 'published') return null
      return normalizeFirestore(d.id, raw, catMap, authorMap)
    }
  } catch (error) {
    console.error('getArticleBySlug error:', error)
  }
  const local = localArticles.find((a) => a.slug === slug)
  if (local) return fromLocal(local)
  return null
}

export async function getArticleById(id: string): Promise<Article | null> {
  // Firestore first (authoritative), then the bundled seed as a fallback.
  try {
    const { catMap, authorMap } = await loadLookups()
    const doc = await adminDb.collection('articles').doc(id).get()
    if (doc.exists) {
      const raw = doc.data() as any
      if (raw.status && raw.status !== 'published') return null
      return normalizeFirestore(doc.id, raw, catMap, authorMap)
    }
  } catch (error) {
    console.error('getArticleById error:', error)
  }
  const local = localArticles.find((a) => a._id === id)
  if (local) return fromLocal(local)
  return null
}
