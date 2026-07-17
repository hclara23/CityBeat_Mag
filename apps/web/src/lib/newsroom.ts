// Autonomous newsroom. Pulls fresh stories from local El Paso / borderland outlet
// RSS feeds (KVIA, El Paso Matters, KTSM, Herald-Post — no key, no quota), which
// carry real article text and direct links, then has Claude re-report each as an
// ORIGINAL, AP-style brief that credits the original outlet — never copying its
// text. The writing rules below are the heart of it: they force wire-service craft
// and ban the tells that mark copy as machine-written.
//
// Needs ANTHROPIC_API_KEY. Sources are free/keyless.

import { traceClaude } from '@/lib/observability'

const MODEL = process.env.NEWSROOM_MODEL || process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

// The "constitution" handed to the writing agent on every article. Kept verbose
// on purpose — this is the single biggest lever on output quality.
export const AI_WRITING_RULES = `You are a staff writer for CityBeat, a professional bilingual (English/Spanish) local news outlet covering El Paso, Texas; Ciudad Juárez, Mexico; and Las Cruces / Doña Ana County, New Mexico. You write complete ORIGINAL local news articles based on facts first reported by another outlet, and you always credit that outlet. Follow every rule below.

NEWS JUDGMENT
- Only write if the item is genuinely relevant to El Paso, Ciudad Juárez, or Las Cruces / southern New Mexico readers. National/celebrity/listicle/SEO-spam items are not publishable.
- If the provided source is too thin to write a few solid paragraphs of verifiable fact, mark it not publishable rather than padding with invention.

CRAFT — write like a wire-service journalist, not an AI:
- Write a COMPLETE article, not a summary. Open with a strong lede (the single most important fact: who/what/where/when), then work through EVERY concrete fact the source gives — names, titles, dates, figures, locations, what happened, what's next, and the background/context the source provides — in inverted-pyramid order (most important first, background last).
- Plain, declarative sentences. Active voice. Concrete nouns, strong verbs, no filler.
- Short paragraphs, one to three sentences each. Aim for 5–8 paragraphs when the source is rich.
- AP style: spell out one through nine, use numerals for 10 and up; "El Paso," "Ciudad Juárez," "Doña Ana County"; dates like "July 16"; times like "7 p.m."; courtesy titles dropped on second reference (last name only).

BANNED AI-ISMS — never use these; they are instant tells of machine copy:
- Openers: "In today's fast-paced world," "In an era of," "Nestled in," "Picture this," or a rhetorical question as the lead.
- Hype adjectives: vibrant, bustling, rich (history/culture/tapestry), hidden gem, boasts, stunning, breathtaking, iconic, beloved, must-see, thriving, charming.
- Transitions/hedges: Moreover, Furthermore, In conclusion, "It's worth noting," "It's important to note," "That said," "Needless to say."
- Verbs/nouns: delve, dive into, unpack, "navigate the landscape," tapestry, "testament to," "stands as," "serves as a reminder," underscores, "highlights the importance of," "plays a vital role."
- Structures: "Not only… but also," "From X to Y," em-dash pile-ups, tricolon lists for rhythm, "whether you're… or…," and any uplifting summary/"takeaway" ending. End on a fact, not a moral.
- No editorializing, no opinion, no advice to the reader, no calls to action, no marketing tone.

ACCURACY & LAW — non-negotiable:
- Report ONLY facts contained in the material you are given. Do NOT invent or infer quotes, statistics, names, ages, dates, dollar figures, or causes. If it isn't in the source material, leave it out.
- Do NOT copy or closely paraphrase the source's sentences or structure. Re-report the facts in your OWN original prose. This is a rewrite specifically to avoid copyright infringement — reproducing the source's expression is not allowed even with attribution.
- Quotes: you MAY include a direct quotation ONLY if it appears verbatim in the source material, attributed to the same speaker (e.g., '"…," Ortega said, according to KTSM.'). Never invent, alter, or present a paraphrase as a verbatim quote.
- Attribute in the body, naming the original outlet at least once, e.g., "according to [Outlet]." Never imply CityBeat independently witnessed, confirmed, or broke the story.

LENGTH: Write as complete an article as the source facts genuinely support — aim for 250–450 words when the source is rich, shorter when it is thin. NEVER pad with invented detail, repetition, or filler to reach a length; a tight 180-word article beats a padded 400-word one. Then a faithful, natural Spanish (es-MX) translation carrying exactly the same facts — not a literal word-for-word conversion.`

export type NewsItem = { title: string; link: string; source: string; summary: string; pubDate: string; ageMs: number }

export type WrittenArticle = {
  publishable: boolean
  category: 'news' | 'business' | 'events' | 'culture'
  title: string
  title_es: string
  excerpt: string
  excerpt_es: string
  body_en: string
  body_es: string
  image_query: string
}

export type ArticleImage = { url: string; credit: string; creditUrl: string }

export function newsroomConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
function pick(chunk: string, tag: string): string {
  const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

// Parse an RSS feed into normalized items. Prefers the full body (WordPress
// content:encoded) over the short description when present.
function parseRss(xml: string, sourceName: string): NewsItem[] {
  const chunks = xml.split(/<item>/i).slice(1).map((c) => c.split(/<\/item>/i)[0])
  const out: NewsItem[] = []
  for (const chunk of chunks) {
    const title = decodeEntities(pick(chunk, 'title')).trim()
    const link = (decodeEntities(pick(chunk, 'link')) || decodeEntities(pick(chunk, 'guid'))).trim()
    const pubDate = pick(chunk, 'pubDate')
    const raw = pick(chunk, 'content:encoded') || pick(chunk, 'description')
    // Keep more of the real article text so the rewrite has enough facts to write
    // a full piece (not a summary) without inventing anything.
    const summary = stripTags(decodeEntities(raw)).slice(0, 4500)
    const t = Date.parse(pubDate)
    const ageMs = Number.isNaN(t) ? 0 : Date.now() - t
    if (title && link) out.push({ title, link, source: sourceName, summary, pubDate, ageMs })
  }
  return out
}

// Local outlet feeds carry real article text + direct links (unlike Google News
// aggregation, which only exposes headlines).
const LOCAL_FEEDS: { name: string; url: string }[] = [
  { name: 'KVIA', url: 'https://kvia.com/feed/' },
  { name: 'El Paso Matters', url: 'https://elpasomatters.org/feed/' },
  { name: 'KTSM', url: 'https://www.ktsm.com/feed/' },
  { name: 'El Paso Herald-Post', url: 'https://elpasoheraldpost.com/feed/' },
]

// Some outlets also carry national wire copy; keep only clearly-local items.
const LOCAL_RE = /\b(el paso|ju[aá]rez|juarez|las cruces|do[ñn]a ana|dona ana|borderland|utep|fort bliss|ysleta|socorro|canutillo|horizon city|sunland park|san elizario|anthony|chihuahua)\b/i

// Fetch fresh local stories across the outlet feeds, newest first, deduped.
export async function fetchElPasoHeadlines(maxAgeHours = 72): Promise<NewsItem[]> {
  const seen = new Set<string>()
  const merged: NewsItem[] = []
  for (const feed of LOCAL_FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 CityBeatNewsroom/1.0' } })
      if (!res.ok) continue
      const xml = await res.text()
      for (const item of parseRss(xml, feed.name)) {
        if (item.ageMs > maxAgeHours * 3600_000) continue
        const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
        if (!key || seen.has(key)) continue
        if (!LOCAL_RE.test(`${item.title} ${item.summary}`)) continue
        seen.add(key)
        merged.push(item)
      }
    } catch {
      /* skip a failing feed */
    }
  }
  return merged.sort((a, b) => a.ageMs - b.ageMs)
}

// Re-report one headline as an original AP-style brief (EN + ES) via Claude.
export async function rewriteAsArticle(item: NewsItem): Promise<WrittenArticle | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  const prompt = `${AI_WRITING_RULES}

Here is the item to re-report. It is another outlet's reporting — your job is to write CityBeat's own COMPLETE article covering the same facts, crediting them.

HEADLINE: ${item.title}
OUTLET: ${item.source}
PUBLISHED: ${item.pubDate}
SOURCE TEXT (all the facts you have — do not go beyond these): ${item.summary || '(no source text; headline only)'}

Respond with ONLY valid JSON (no markdown fences):
{
  "publishable": true | false,
  "category": "news" | "business" | "events" | "culture",
  "title": "<AP-style headline, factual, no clickbait, under 90 chars>",
  "title_es": "<Spanish headline>",
  "excerpt": "<one factual sentence, under 160 chars>",
  "excerpt_es": "<Spanish, under 160 chars>",
  "body_en": "<a COMPLETE article, 250-450 words when the source supports it (shorter if thin), paragraphs separated by \\n\\n, uses every concrete fact from the source, names the outlet with 'according to ${item.source}'>",
  "body_es": "<faithful es-MX translation, same paragraph breaks>",
  "image_query": "<2-4 plain English words for a generic stock/illustrative photo of the subject, e.g. 'public mural artist' or 'city council chamber'; NO personal names, NO brand names>"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    await traceClaude('newsroom.rewrite', prompt, data, { source: item.source })
    const text: string = data?.content?.[0]?.text || ''
    const parsed = JSON.parse(text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim())
    if (!parsed || parsed.publishable === false || !parsed.title || !parsed.body_en) return null
    const cat = ['news', 'business', 'events', 'culture'].includes(parsed.category) ? parsed.category : 'news'
    return {
      publishable: true,
      category: cat,
      title: String(parsed.title).slice(0, 140),
      title_es: String(parsed.title_es || parsed.title).slice(0, 160),
      excerpt: String(parsed.excerpt || '').slice(0, 200),
      excerpt_es: String(parsed.excerpt_es || parsed.excerpt || '').slice(0, 200),
      body_en: String(parsed.body_en).slice(0, 6000),
      body_es: String(parsed.body_es || parsed.body_en).slice(0, 6000),
      image_query: String(parsed.image_query || '').slice(0, 60),
    }
  } catch {
    return null
  }
}

// Legally-safe illustrative image via Openverse — the CC-licensed/public-domain
// media search (openverse.org, no API key). We only accept results cleared for
// commercial reuse (modification allowed) and we KEEP the attribution so the
// article can credit the photographer + license. These are illustrative stock
// images, not the actual news scene — the article page labels them as such.
async function openverseSearch(q: string): Promise<ArticleImage | null> {
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}` +
    `&license_type=commercial,modification&mature=false&page_size=8`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CityBeatNewsroom/1.0 (+https://citybeatmag.co)' },
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const hit = (data?.results || []).find((r: any) => r?.url && (r?.creator || r?.license))
    if (!hit) return null
    const licenseName = [hit.license, hit.license_version].filter(Boolean).join(' ').toUpperCase()
    const credit = `Photo: ${hit.creator || 'Unknown'} · ${licenseName || 'CC'} via Openverse`
    return {
      url: String(hit.url),
      credit: credit.slice(0, 200),
      creditUrl: String(hit.foreign_landing_url || hit.license_url || 'https://openverse.org'),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Progressive search — a full headline is too specific for stock/CC search, so
// try the (short) query, then fall back to its first few keywords.
export async function findArticleImage(query: string): Promise<ArticleImage | null> {
  const base = query.trim()
  if (!base) return null
  const words = base.split(/\s+/).filter((w) => w.length > 2)
  const attempts = Array.from(
    new Set([base, words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')].map((s) => s.trim()).filter(Boolean)),
  )
  for (const q of attempts) {
    const hit = await openverseSearch(q)
    if (hit) return hit
  }
  return null
}
