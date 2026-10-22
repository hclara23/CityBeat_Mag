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

/**
 * Coerce a sitemap shard id before judging it.
 *
 * THE BUG THIS FIXES: Next passes the dynamic sitemap segment as a STRING
 * ('0'), and the handler guarded with `Number.isInteger(id)`.
 * `Number.isInteger('0')` is false, so EVERY request returned an empty array.
 * /directory/sitemap/0.xml served a well-formed 110-byte empty urlset, and
 * robots.txt advertises that file as the ONLY directory sitemap — so all 8,037
 * published business listings were never submitted to any search engine. That
 * is a complete explanation for a 9,789-business directory producing almost no
 * organic arrivals.
 *
 * Lives here, in the pure module, because the handler imports Firestore and the
 * alerting layer and therefore cannot be imported by a unit test — which is
 * exactly why the original shipped behind a green gate.
 */
export function parseShardId(id: unknown): number | null {
  const n = typeof id === 'number' ? id : Number.parseInt(String(id ?? ''), 10)
  return Number.isInteger(n) && n >= 0 ? n : null
}
