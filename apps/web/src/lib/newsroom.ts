// Autonomous newsroom. Pulls El Paso / borderland headlines from Google News RSS
// (no API key, no quota), then has Claude re-report each as an ORIGINAL, AP-style
// news brief that credits the original outlet — never copying source text. The
// writing rules below are the heart of it: they force wire-service craft and ban
// the tells that mark copy as machine-written.
//
// Needs ANTHROPIC_API_KEY. Source is free/keyless.

const MODEL = process.env.NEWSROOM_MODEL || process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

// The "constitution" handed to the writing agent on every article. Kept verbose
// on purpose — this is the single biggest lever on output quality.
export const AI_WRITING_RULES = `You are a staff writer for CityBeat, a professional bilingual (English/Spanish) local news outlet covering El Paso, Texas; Ciudad Juárez, Mexico; and Las Cruces / Doña Ana County, New Mexico. You write short ORIGINAL news briefs based on facts first reported by another outlet, and you always credit that outlet. Follow every rule below.

NEWS JUDGMENT
- Only write if the item is genuinely relevant to El Paso, Ciudad Juárez, or Las Cruces / southern New Mexico readers. National/celebrity/listicle/SEO-spam items are not publishable.
- If the provided summary is too thin to write even ~80 words of verifiable fact, mark it not publishable rather than padding with invention.

CRAFT — write like a wire-service journalist, not an AI:
- Lead with the news. The first sentence states the single most important fact (who / what / where / when). Inverted pyramid: most important first, background last.
- Plain, declarative sentences. Active voice. Concrete nouns, strong verbs, no filler.
- Short paragraphs, one to three sentences each.
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
- Do NOT copy or lightly paraphrase the source's sentences. Re-report the facts entirely in your own structure and words. This is a rewrite specifically to avoid copyright infringement.
- Attribute in the body, naming the original outlet at least once, e.g., "according to [Outlet]." Never imply CityBeat independently witnessed, confirmed, or broke the story.

LENGTH: English body 80–160 words. Then a faithful, natural Spanish (es-MX) translation carrying exactly the same facts — not a literal word-for-word conversion.`

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
}

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

// Parse a Google News RSS feed into normalized items (newest first).
function parseRss(xml: string): NewsItem[] {
  const chunks = xml.split(/<item>/i).slice(1).map((c) => c.split(/<\/item>/i)[0])
  const out: NewsItem[] = []
  for (const chunk of chunks) {
    const source = decodeEntities(pick(chunk, 'source'))
    let title = decodeEntities(pick(chunk, 'title'))
    // Google appends " - Source"; drop it since we track the source separately.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim()
    const link = decodeEntities(pick(chunk, 'link'))
    const pubDate = pick(chunk, 'pubDate')
    const summary = stripTags(decodeEntities(pick(chunk, 'description')))
    const t = Date.parse(pubDate)
    const ageMs = Number.isNaN(t) ? 0 : Date.now() - t
    if (title && link) out.push({ title, link, source: source || 'the source', summary, pubDate, ageMs })
  }
  return out
}

// Fetch fresh borderland headlines. Queries a few local terms and merges, newest
// first, de-duplicated by normalized title.
export async function fetchElPasoHeadlines(maxAgeHours = 72): Promise<NewsItem[]> {
  const queries = ['"El Paso"', '"Ciudad Juárez" OR "Juarez"', '"Las Cruces" OR "Doña Ana County"']
  const seen = new Set<string>()
  const merged: NewsItem[] = []
  for (const q of queries) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:3d')}&hl=en-US&gl=US&ceid=US:en`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 CityBeatNewsroom/1.0' } })
      if (!res.ok) continue
      const xml = await res.text()
      for (const item of parseRss(xml)) {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
        if (seen.has(key)) continue
        if (item.ageMs > maxAgeHours * 3600_000) continue
        seen.add(key)
        merged.push(item)
      }
    } catch {
      /* skip a failing query */
    }
  }
  return merged.sort((a, b) => a.ageMs - b.ageMs)
}

// Re-report one headline as an original AP-style brief (EN + ES) via Claude.
export async function rewriteAsArticle(item: NewsItem): Promise<WrittenArticle | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  const prompt = `${AI_WRITING_RULES}

Here is the item to re-report. It is another outlet's reporting — your job is to write CityBeat's own short brief of the same facts, crediting them.

HEADLINE: ${item.title}
OUTLET: ${item.source}
PUBLISHED: ${item.pubDate}
SUMMARY (all the facts you have — do not go beyond these): ${item.summary || '(no summary provided; headline only)'}

Respond with ONLY valid JSON (no markdown fences):
{
  "publishable": true | false,
  "category": "news" | "business" | "events" | "culture",
  "title": "<AP-style headline, factual, no clickbait, under 90 chars>",
  "title_es": "<Spanish headline>",
  "excerpt": "<one factual sentence, under 160 chars>",
  "excerpt_es": "<Spanish, under 160 chars>",
  "body_en": "<80-160 words, paragraphs separated by \\n\\n, includes 'according to ${item.source}'>",
  "body_es": "<faithful es-MX translation, same paragraph breaks>"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return null
    const data: any = await res.json()
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
      body_en: String(parsed.body_en).slice(0, 4000),
      body_es: String(parsed.body_es || parsed.body_en).slice(0, 4000),
    }
  } catch {
    return null
  }
}
