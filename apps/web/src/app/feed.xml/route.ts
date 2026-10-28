import { getPublishedArticles } from '@/lib/articles'
import { reportFailure } from '@/lib/alerts'

// RSS 2.0, in both languages.
//
// Every one of the four local outlets this newsroom re-reports and credits —
// KVIA, El Paso Matters, KTSM and the Herald-Post — publishes a feed; that is
// precisely how lib/newsroom.ts ingests them. CityBeat published none, so a
// magazine with 258 stories and four new briefs a day could not be syndicated,
// added to anyone's reader, picked up by an aggregator, or ingested by the same
// kind of pipeline it runs against its competitors. Its only distribution
// channels were the sitemap, the Friday newsletter and a Facebook page.
//
// Spanish gets its own feed at /feed.xml?lang=es rather than one bilingual file:
// a reader subscribing in Spanish wants Spanish items, and RSS has no per-item
// language negotiation. El Paso is ~90% Spanish-speaking, so shipping only the
// English feed would be the same mistake as burying the locale toggle.

export const revalidate = 1800
export const runtime = 'nodejs'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FEED_LIMIT = 50

/**
 * XML text escaping. Deliberately not a CDATA wrapper: a headline containing
 * "]]>" would terminate the section early and break the whole document for every
 * subscriber, and headlines come from an AI writer and from editors.
 */
function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** RFC 822, which is what RSS 2.0 requires — not ISO 8601. */
function rfc822(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString()
}

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('lang') === 'es' ? 'es' : 'en'
  const es = locale === 'es'

  let articles: Awaited<ReturnType<typeof getPublishedArticles>> = []
  try {
    articles = await getPublishedArticles({ limit: FEED_LIMIT })
  } catch (error) {
    // A feed that silently serves zero items looks identical to a quiet news
    // week, and every subscriber would simply see nothing new forever.
    await reportFailure('feed', error, { locale }).catch(() => {})
    return new Response('Feed temporarily unavailable', { status: 503 })
  }

  const title = es ? 'CityBeat — Noticias de El Paso' : 'CityBeat — El Paso News'
  const description = es
    ? 'Noticias locales, negocios, eventos y cultura del condado de El Paso y el sur de Nuevo México.'
    : 'Local news, business, events and culture from El Paso County and southern New Mexico.'

  const items = articles
    .map((a) => {
      const link = `${BASE}/${locale}/stories/${encodeURIComponent(a.slug)}`
      return `    <item>
      <title>${xml(es ? a.titleES || a.title : a.title)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="true">${xml(link)}</guid>
      <pubDate>${xml(rfc822(a.publishedAt))}</pubDate>
      <description>${xml(es ? a.excerptES || a.excerpt : a.excerpt)}</description>
      <category>${xml(a.category)}</category>
    </item>`
    })
    .join('\n')

  // The newest item's date, not `now`: a channel whose lastBuildDate moves every
  // thirty minutes while nothing is published teaches aggregators to ignore it,
  // the same way a `now` lastmod did in the sitemap.
  const built = articles.length ? rfc822(articles[0].publishedAt) : new Date().toUTCString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(`${BASE}/${locale}/stories`)}</link>
    <description>${xml(description)}</description>
    <language>${es ? 'es-MX' : 'en-US'}</language>
    <lastBuildDate>${xml(built)}</lastBuildDate>
    <atom:link href="${xml(`${BASE}/feed.xml${es ? '?lang=es' : ''}`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    },
  })
}
