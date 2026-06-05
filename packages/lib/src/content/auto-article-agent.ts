import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type GdeltArticle = {
  url?: string
  url_mobile?: string
  title?: string
  seendate?: string
  socialimage?: string
  domain?: string
  language?: string
  sourcecountry?: string
}

type GdeltResponse = {
  articles?: GdeltArticle[]
}

type ResearchTopic = {
  title: string
  sourceUrl: string
  sourceDomain: string
  seenAt?: string
  imageUrl?: string
  category: string
  tags: string[]
}

type DraftArticle = {
  title: string
  excerpt: string
  bodyText: string
  sourceUrls: string[]
  sourcePublishedAt?: string
  imageUrl?: string
  category: string
  tags: string[]
}

export type AutoArticleAgentOptions = {
  supabaseUrl?: string
  supabaseServiceKey?: string
  ownerEmail?: string
  limit?: number
  dryRun?: boolean
  now?: Date
}

export type AutoArticleAgentResult = {
  ok: boolean
  generated: number
  skipped: number
  topics: Array<{ title: string; sourceUrl: string }>
  articles: Array<{ id: string; title: string; status: string }>
}

const DEFAULT_OWNER_EMAIL = 'citybeat@yahoo.com'
const DEFAULT_LIMIT = 3
const AGENT_NAME = 'citybeat-auto-research-agent'
const SEARCH_TERMS = [
  '"El Paso County"',
  '"El Paso" business',
  '"El Paso" city',
  '"El Paso" arts',
]
const RSS_FEEDS = [
  'https://kvia.com/feed',
  'https://www.ktsm.com/feed',
  'https://elpasonews.org/feed',
  'https://elpasomatters.org/feed',
]
const LOCAL_RELEVANCE_PATTERN = /\b(el paso|el paso county|ju[aá]rez|fort bliss|borderland|canutillo|ysleta|socorro|horizon city|anthony|san elizario)\b/i

function assertConfig(options: AutoArticleAgentOptions) {
  if (!options.supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  if (!options.supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 84)
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripHtml(value: string) {
  return normalizeText(decodeXml(value).replace(/<[^>]+>/g, ' '))
}

function extractTag(item: string, tagName: string) {
  const match = item.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match ? stripHtml(match[1]) : ''
}

function extractUrl(item: string) {
  const link = extractTag(item, 'link')
  if (link) return link

  const guid = extractTag(item, 'guid')
  return /^https?:\/\//i.test(guid) ? guid : ''
}

function extractImage(item: string) {
  const mediaMatch = item.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)
  if (mediaMatch) return decodeXml(mediaMatch[1])

  const enclosureMatch = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i)
  return enclosureMatch ? decodeXml(enclosureMatch[1]) : undefined
}

function tiptapParagraphs(text: string) {
  return text
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    }))
}

function parseGdeltDate(value?: string) {
  if (!value) return undefined
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?Z?$/)
  if (compact) {
    const [, year, month, day, hour, minute, second = '00'] = compact
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function inferCategory(title: string) {
  const lower = title.toLowerCase()
  if (/(restaurant|business|retail|store|company|market|jobs|economy|development)/.test(lower)) {
    return 'business'
  }
  if (/(music|art|museum|festival|culture|film|gallery|concert)/.test(lower)) return 'culture'
  if (/(school|college|university|education|student|teacher)/.test(lower)) return 'news'
  if (/(event|weekend|calendar|parade|fair)/.test(lower)) return 'events'
  return 'news'
}

function isLocallyRelevant(text: string) {
  return LOCAL_RELEVANCE_PATTERN.test(text)
}

function tagsForTopic(topic: ResearchTopic) {
  return Array.from(new Set(['el paso', topic.category, ...topic.tags])).slice(0, 8)
}

async function fetchGdeltTopics(now: Date, limit: number) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const deduped = new Map<string, ResearchTopic>()

  for (const term of SEARCH_TERMS) {
    const params = new URLSearchParams({
      query: term,
      mode: 'artlist',
      format: 'json',
      maxrecords: '50',
      sort: 'datedesc',
      timespan: '7d',
    })

    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
      headers: { accept: 'application/json' },
    }).catch(() => null)
    if (!response || !response.ok) continue

    const payload = (await response.json().catch(() => ({}))) as GdeltResponse
    for (const article of payload.articles || []) {
      const sourceUrl = article.url || article.url_mobile
      const title = normalizeText(article.title || '')
      if (!sourceUrl || !title || !/el paso/i.test(title)) continue

      const seenAt = parseGdeltDate(article.seendate)
      if (seenAt && new Date(seenAt) < since) continue

      const category = inferCategory(title)
      deduped.set(sourceUrl, {
        title,
        sourceUrl,
        sourceDomain: article.domain || new URL(sourceUrl).hostname,
        seenAt,
        imageUrl: article.socialimage,
        category,
        tags: [term.replace(/"/g, '').replace(/\s+/g, ' ').trim()],
      })
    }

    if (deduped.size >= limit * 4) break
  }

  return Array.from(deduped.values())
}

async function fetchRssTopics(now: Date, limit: number) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const deduped = new Map<string, ResearchTopic>()

  for (const feedUrl of RSS_FEEDS) {
    const response = await fetch(feedUrl, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml',
        'user-agent': 'CityBeatMagResearchAgent/1.0',
      },
    }).catch(() => null)
    if (!response || !response.ok) continue

    const xml = await response.text().catch(() => '')
    const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => match[0])
    for (const item of items) {
      const title = normalizeText(extractTag(item, 'title'))
      const sourceUrl = extractUrl(item)
      if (!title || !sourceUrl) continue
      if (/\/author\/|\/about\/|\/staff\//i.test(sourceUrl)) continue
      if (/\b(anchor|reporter|meteorologist|producer)\b/i.test(title)) continue
      const description = extractTag(item, 'description')
      const categoryText = extractTag(item, 'category')
      if (!isLocallyRelevant(`${title} ${description} ${categoryText} ${sourceUrl}`)) continue

      const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'dc:date')
      const seenAt = parseGdeltDate(pubDate)
      if (seenAt && new Date(seenAt) < since) continue

      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '')
      const category = inferCategory(`${title} ${categoryText}`)
      deduped.set(sourceUrl, {
        title,
        sourceUrl,
        sourceDomain: hostname,
        seenAt,
        imageUrl: extractImage(item),
        category,
        tags: [hostname, category],
      })
    }

    if (deduped.size >= limit * 4) break
  }

  return Array.from(deduped.values())
}

function createDraft(topic: ResearchTopic, now: Date): DraftArticle {
  const title = topic.title.replace(/\s+-\s+[^-]+$/, '').trim()
  const sourceDate = topic.seenAt
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' }).format(new Date(topic.seenAt))
    : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' }).format(now)

  const excerpt = `A source-backed draft for editors tracking a recent El Paso development reported by ${topic.sourceDomain}.`
  const bodyText = [
    `${title}`,
    `CityBeat's automated research desk flagged this recent El Paso topic for editorial review. The source item was seen on ${sourceDate} from ${topic.sourceDomain}.`,
    `What editors should verify: confirm the core facts directly with the original source, check whether the story affects El Paso residents, businesses, neighborhoods, or institutions, and add local context before publication.`,
    `Why it matters: topics surfaced here are selected because they reference El Paso and match CityBeat coverage areas such as local government, business, public safety, culture, education, and community development.`,
    `Suggested reporting angle: explain what changed, who is affected, what happens next, and where readers can find official or primary-source information.`,
    `Primary source for review: ${topic.sourceUrl}`,
    `Editorial note: this draft is intentionally unpublished and should be rewritten, fact-checked, and approved by a human editor before it appears on CityBeat.`,
  ].join('\n\n')

  return {
    title,
    excerpt,
    bodyText,
    sourceUrls: [topic.sourceUrl],
    sourcePublishedAt: topic.seenAt,
    imageUrl: topic.imageUrl,
    category: topic.category,
    tags: tagsForTopic(topic),
  }
}

async function getCategoryId(supabase: SupabaseClient, slug: string) {
  const { data: existing, error: selectError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing?.id) return existing.id as string

  const label = slug.charAt(0).toUpperCase() + slug.slice(1)
  const { data: created, error } = await supabase
    .from('categories')
    .insert({ slug, name_en: label, name_es: label })
    .select('id')
    .single()

  if (error) throw error
  return created.id as string
}

async function getAuthorId(supabase: SupabaseClient) {
  const name = 'CityBeat Research Desk'
  const { data: existing, error: selectError } = await supabase
    .from('authors')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from('authors')
    .insert({
      name,
      bio: 'Automated research queue for source-backed story candidates. Human editorial review required before publication.',
    })
    .select('id')
    .single()

  if (error) throw error
  return created.id as string
}

async function getOwnerProfileId(supabase: SupabaseClient, ownerEmail: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ownerEmail)
    .maybeSingle()

  if (error) throw error
  if (!data?.id) throw new Error(`Auto article owner profile not found for ${ownerEmail}`)
  return data.id as string
}

async function hasExistingArticleForSource(supabase: SupabaseClient, sourceUrl: string, title: string) {
  const { data: sourceMatch, error: sourceError } = await supabase
    .from('articles')
    .select('id')
    .contains('source_urls', [sourceUrl])
    .limit(1)

  if (sourceError) throw sourceError
  if ((sourceMatch || []).length > 0) return true

  const { data: titleMatch, error: titleError } = await supabase
    .from('articles')
    .select('id')
    .ilike('title', title)
    .limit(1)

  if (titleError) throw titleError
  return (titleMatch || []).length > 0
}

async function insertTags(supabase: SupabaseClient, articleId: string, tags: string[]) {
  const cleanTags = Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)))
  if (cleanTags.length === 0) return

  const { data: tagRows, error: tagError } = await supabase
    .from('tags')
    .upsert(cleanTags.map((name) => ({ name })), { onConflict: 'name' })
    .select('id')

  if (tagError) throw tagError
  if (!tagRows || tagRows.length === 0) return

  const { error } = await supabase
    .from('article_tags')
    .insert(tagRows.map((tag) => ({ article_id: articleId, tag_id: tag.id })))

  if (error) throw error
}

async function countGeneratedSince(supabase: SupabaseClient, since: Date) {
  const { count, error } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('generated_by', AGENT_NAME)
    .gte('created_at', since.toISOString())

  if (error) throw error
  return count || 0
}

export async function runAutoArticleAgent(options: AutoArticleAgentOptions): Promise<AutoArticleAgentResult> {
  assertConfig(options)

  const now = options.now || new Date()
  const limit = Math.max(1, Math.min(options.limit || DEFAULT_LIMIT, 5))
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const ownerEmail = options.ownerEmail || DEFAULT_OWNER_EMAIL
  const supabase = createClient(options.supabaseUrl as string, options.supabaseServiceKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const generatedToday = options.dryRun ? 0 : await countGeneratedSince(supabase, dayStart)
  const remaining = Math.max(0, limit - generatedToday)
  if (remaining === 0) {
    return {
      ok: true,
      generated: 0,
      skipped: 0,
      topics: [],
      articles: [],
    }
  }

  const rssTopics = await fetchRssTopics(now, remaining)
  const gdeltTopics = rssTopics.length >= remaining ? [] : await fetchGdeltTopics(now, remaining)
  const topicsByUrl = new Map<string, ResearchTopic>()
  for (const topic of [...rssTopics, ...gdeltTopics]) {
    topicsByUrl.set(topic.sourceUrl, topic)
  }
  const topics = Array.from(topicsByUrl.values())
  const ownerId = await getOwnerProfileId(supabase, ownerEmail)
  const authorId = await getAuthorId(supabase)
  const articles: AutoArticleAgentResult['articles'] = []
  let skipped = 0

  for (const topic of topics) {
    if (articles.length >= remaining) break

    const draft = createDraft(topic, now)
    if (await hasExistingArticleForSource(supabase, draft.sourceUrls[0], draft.title)) {
      skipped += 1
      continue
    }

    const categoryId = await getCategoryId(supabase, draft.category)
    const articleData = {
      title: draft.title,
      slug: `${slugify(draft.title)}-${now.getTime().toString(36)}-${articles.length + 1}`,
      excerpt: draft.excerpt,
      content: tiptapParagraphs(draft.bodyText),
      category_id: categoryId,
      author_id: authorId,
      created_by: ownerId,
      status: 'pending_review',
      published_at: null,
      image_url: draft.imageUrl || null,
      cover_image_path: draft.imageUrl || null,
      generated_by: AGENT_NAME,
      source_urls: draft.sourceUrls,
      source_published_at: draft.sourcePublishedAt || null,
      generation_metadata: {
        agent: AGENT_NAME,
        source_domain: topic.sourceDomain,
        searched_at: now.toISOString(),
        requires_human_review: true,
      },
    }

    if (options.dryRun) {
      articles.push({ id: `dry-run-${articles.length + 1}`, title: draft.title, status: 'pending_review' })
      continue
    }

    const { data: created, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select('id,title,status')
      .single()

    if (error) throw error
    await insertTags(supabase, created.id, draft.tags)
    articles.push({ id: created.id, title: created.title, status: created.status })
  }

  return {
    ok: true,
    generated: articles.length,
    skipped,
    topics: topics.slice(0, limit * 2).map((topic) => ({ title: topic.title, sourceUrl: topic.sourceUrl })),
    articles,
  }
}
