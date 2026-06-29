import type { MetadataRoute } from 'next'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { localArticles } from '@/lib/localArticles'
import { getNonEmptyCombos } from '@/lib/local-seo'
import { getUpcomingEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}/en${path}`,
    lastModified: lastModified || new Date(),
    alternates: { languages: { en: `${BASE}/en${path}`, es: `${BASE}/es${path}` } },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    '', '/stories', '/directory', '/best', '/events', '/deals', '/jobs', '/ads', '/contribute', '/privacy', '/terms',
    '/topics/news', '/topics/business', '/topics/events', '/topics/culture',
  ]
  const urls: MetadataRoute.Sitemap = staticPaths.map((p) => entry(p))

  // Upcoming events (Event-structured detail pages).
  try {
    const events = await getUpcomingEvents(200)
    events.forEach((e) => urls.push(entry(`/events/${e.id}`)))
  } catch {
    /* ignore */
  }

  // Programmatic local-SEO pages: every (category × city) combo that has listings.
  try {
    const combos = await getNonEmptyCombos()
    combos.forEach(({ category, city }) => urls.push(entry(`/best/${category.slug}/${city.slug}`)))
  } catch {
    /* ignore — still emit the rest */
  }

  // Published stories (Firestore articles + bundled seed content).
  const slugs = new Set<string>(localArticles.map((a) => a.slug))
  try {
    const snap = await adminDb.collection('articles').where('status', '==', 'published').get()
    snap.forEach((d) => {
      const s = (d.data() as any).slug
      if (s) slugs.add(s)
    })
  } catch {
    /* ignore — still emit static + seed */
  }
  slugs.forEach((s) => urls.push(entry(`/stories/${s}`)))

  // Directory listings (the long-tail local-SEO engine).
  try {
    const snap = await adminDb.collection('directory_listings').get()
    snap.forEach((d) => urls.push(entry(`/directory/${d.id}`)))
  } catch {
    /* ignore */
  }

  return urls
}
