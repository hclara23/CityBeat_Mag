import { adminDb } from '@citybeat/lib/firebase/admin'
import { unstable_cache } from 'next/cache'

// Leave headroom for static, story, event, job and local-guide URLs on shard 0.
// Search engines cap one sitemap at 50,000 URLs.
export const DIRECTORY_SITEMAP_PAGE_SIZE = 45_000

export function directorySitemapPageCount(totalPublished: number): number {
  if (!Number.isFinite(totalPublished) || totalPublished <= 0) return 1
  return Math.max(1, Math.ceil(totalPublished / DIRECTORY_SITEMAP_PAGE_SIZE))
}

async function countPublishedDirectoryListings(): Promise<number> {
  const result = await adminDb
    .collection('directory_listings')
    .where('is_published', '==', true)
    .count()
    .get()
  return result.data().count
}

export const getDirectorySitemapPageCount = unstable_cache(
  async () => {
    try {
      return directorySitemapPageCount(await countPublishedDirectoryListings())
    } catch {
      // Keep the public sitemap discoverable during a transient database outage.
      return 1
    }
  },
  ['directory-sitemap-page-count-v1'],
  { revalidate: 3600, tags: ['directory'] }
)
