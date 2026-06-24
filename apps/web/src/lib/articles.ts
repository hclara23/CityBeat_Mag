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

async function loadLookups() {
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

function normalizeFirestore(
  id: string,
  a: any,
  catMap: Map<string, string>,
  authorMap: Map<string, string>
): Article {
  const text = blocksToText(a.content)
  // Spanish fields are populated by the translation pipeline; fall back to EN.
  const textEs = a.content_es ? blocksToText(a.content_es) : text
  const rawPublished = a.published_at?.toDate ? a.published_at.toDate().toISOString() : a.published_at
  const createdAt = a.created_at?.toDate ? a.created_at.toDate().toISOString() : a.created_at
  const publishedAt =
    (typeof rawPublished === 'string' && rawPublished) ||
    (typeof createdAt === 'string' && createdAt) ||
    new Date().toISOString()
  const title = a.title || 'Untitled'
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
  }
}

export async function getPublishedArticles(
  opts: { category?: string; limit?: number } = {}
): Promise<Article[]> {
  let firestoreArticles: Article[] = []
  try {
    const { catMap, authorMap } = await loadLookups()
    // No orderBy here to avoid requiring a composite index; sorted in memory below.
    const snap = await adminDb.collection('articles').where('status', '==', 'published').get()
    firestoreArticles = snap.docs.map((d) => normalizeFirestore(d.id, d.data(), catMap, authorMap))
  } catch (error) {
    console.error('getPublishedArticles firestore error:', error)
  }

  // Firestore is the source of truth (the seed has been migrated into it). The
  // bundled seed is only a fallback for when Firestore returns nothing — e.g. the
  // migration hasn't run yet or the fetch failed — so the site never goes empty.
  let result = (firestoreArticles.length > 0
    ? firestoreArticles
    : localArticles.map(fromLocal)
  ).sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1))

  if (opts.category && opts.category !== 'all') {
    result = result.filter((a) => a.category === opts.category)
  }
  if (opts.limit) result = result.slice(0, opts.limit)
  return result
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  // Firestore first (authoritative), then the bundled seed as a fallback.
  try {
    const { catMap, authorMap } = await loadLookups()
    const snap = await adminDb.collection('articles').where('slug', '==', slug).limit(1).get()
    if (!snap.empty) {
      const d = snap.docs[0]
      return normalizeFirestore(d.id, d.data(), catMap, authorMap)
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
    if (doc.exists) return normalizeFirestore(doc.id, doc.data() as any, catMap, authorMap)
  } catch (error) {
    console.error('getArticleById error:', error)
  }
  const local = localArticles.find((a) => a._id === id)
  if (local) return fromLocal(local)
  return null
}
