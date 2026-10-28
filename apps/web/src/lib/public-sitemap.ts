import type { MetadataRoute } from 'next'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { localArticles } from '@/lib/localArticles'
import { getNonEmptyCombos } from '@/lib/local-seo'
import { getUpcomingEvents } from '@/lib/events'
import { unstable_cache } from 'next/cache'
import { coverStory } from '@/lib/cover-story'
import machelleStory from '@/lib/machelle-story.json'

// Called only by the runtime route; credential-free builds never scan Firestore.

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}/en${path}`,
    ...(lastModified ? { lastModified } : {}),
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

/**
 * A lastmod can never be in the future: a page cannot have been modified at a
 * time that has not happened. A future value is the standard trigger for a
 * crawler distrusting the field across the WHOLE file — which would cost the
 * honest story lastmods below the trust they were added to earn.
 *
 * Production was publishing 100 of them: every Ticketmaster event URL carried
 * its event's START DATE as its last-modified date, the newest being
 * 2026-12-11. That is 28% of the sitemap's 355 lastmod values, refreshed
 * unattended four times a day by citybeat-sync-events, with nothing checking it.
 */
export function lastModified(candidates: unknown[], now: Date = new Date()): Date | undefined {
  for (const candidate of candidates) {
    const parsed = toDate(candidate)
    if (parsed && parsed.getTime() <= now.getTime()) return parsed
  }
  return undefined
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
    // When the record was last TOUCHED, never when the event begins. Falls back
    // through updated_at -> created_at and omits lastmod entirely rather than
    // publishing a date that has not happened yet.
    events.forEach((e: any) =>
      urls.push(entry(`/events/${e.id}`, lastModified([e.updated_at, e.created_at])))
    )
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
        urls.push(entry(`/jobs/${d.id}`, lastModified([data.updated_at, data.created_at])))
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
  localArticles.forEach((a) => slugDates.set(a.slug, lastModified([(a as any).publishedAt])))
  try {
    const snap = await adminDb.collection('articles').where('status', '==', 'published').get()
    snap.forEach((d) => {
      const data = d.data() as any
      // A SCHEDULED post carries a publishedAt in the future; lastModified skips it
      // and falls through rather than publishing a date that has not happened.
      if (data.slug) slugDates.set(data.slug, lastModified([data.updatedAt, data.updated_at, data.published_at, data.publishedAt]))
    })
  } catch {
    /* ignore — still emit static + seed */
  }
  slugDates.forEach((date, s) => urls.push(entry(`/stories/${s}`, date)))

  return urls
}

const cachedSitemap = unstable_cache(buildSitemap, ['public-sitemap-v4'], { revalidate: 3600 })
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return cachedSitemap()
}
