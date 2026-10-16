import type { MetadataRoute } from 'next'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { localArticles } from '@/lib/localArticles'
import { getNonEmptyCombos } from '@/lib/local-seo'
import { getUpcomingEvents } from '@/lib/events'
import { unstable_cache } from 'next/cache'
import { coverStory } from '@/lib/cover-story'
import machelleStory from '@/lib/machelle-story.json'

// ISR: regenerate at most hourly (was force-dynamic, so every /sitemap.xml hit
// ran full scans of listings + articles + events + jobs + the 24 category reads).
// Runtime-only DB scans keep image builds credential-free. Cache hourly below.
export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}/en${path}`,
    lastModified: lastModified || new Date(),
    alternates: { languages: { en: `${BASE}/en${path}`, es: `${BASE}/es${path}`, 'x-default': `${BASE}/en${path}` } },
  }
}

// Real lastmod so Google trusts the freshness signal (was `now` for every URL,
// which trains crawlers to ignore lastmod). Accepts Firestore Timestamp or ISO.
function toDate(v: any): Date | undefined {
  if (!v) return undefined
  if (typeof v?.toDate === 'function') {
    const d = v.toDate()
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined
  }
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    '', '/stories', '/directory', '/best', '/events', '/this-weekend', '/deals', '/jobs', '/ads', '/contribute', '/privacy', '/cookies', '/terms',
    '/leaderboard', '/guide', '/premium', coverStory.path, `/stories/${machelleStory.slug}`,
    '/topics/news', '/topics/business', '/topics/events', '/topics/culture',
  ]
  const urls: MetadataRoute.Sitemap = staticPaths.map((p) => entry(p))

  // Upcoming events (Event-structured detail pages).
  try {
    const events = await getUpcomingEvents(200)
    events.forEach((e) => urls.push(entry(`/events/${e.id}`, toDate(e.start_date))))
  } catch {
    /* ignore */
  }

  // Active paid job detail pages (each is its own indexable JobPosting URL).
  // Single-field filter + in-memory expiry check avoids a composite-index
  // dependency; the try/catch keeps a failure from breaking the rest.
  try {
    const now = new Date().toISOString()
    const snap = await adminDb.collection('jobs').where('is_paid', '==', true).get()
    snap.forEach((d) => {
      const data = d.data() as any
      if (!data.expires_at || data.expires_at > now) {
        urls.push(entry(`/jobs/${d.id}`, toDate(data.updated_at || data.created_at)))
      }
    })
  } catch {
    /* ignore — still emit the rest */
  }

  // Programmatic local-SEO pages: every (category × city) combo that has listings.
  try {
    const combos = await getNonEmptyCombos()
    combos.forEach(({ category, city }) => urls.push(entry(`/best/${category.slug}/${city.slug}`)))
  } catch {
    /* ignore — still emit the rest */
  }

  // Published stories (Firestore articles + bundled seed content). Track each
  // slug's real modified date for an honest lastmod (news freshness signal).
  const slugDates = new Map<string, Date | undefined>()
  localArticles.forEach((a) => slugDates.set(a.slug, toDate((a as any).publishedAt)))
  try {
    const snap = await adminDb.collection('articles').where('status', '==', 'published').get()
    snap.forEach((d) => {
      const data = d.data() as any
      if (data.slug) slugDates.set(data.slug, toDate(data.updatedAt || data.updated_at || data.published_at || data.publishedAt))
    })
  } catch {
    /* ignore — still emit static + seed */
  }
  slugDates.forEach((date, s) => urls.push(entry(`/stories/${s}`, date)))

  return urls
}

const cachedSitemap = unstable_cache(buildSitemap, ['public-sitemap-v3'], { revalidate: 3600 })
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return cachedSitemap()
}
