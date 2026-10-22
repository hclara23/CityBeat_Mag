import type { MetadataRoute } from 'next'
import { FieldPath } from 'firebase-admin/firestore'
import { unstable_cache } from 'next/cache'
import { adminDb } from '@citybeat/lib/firebase/admin'
import {
  DIRECTORY_SITEMAP_PAGE_SIZE,
  getDirectorySitemapPageCount,
  parseShardId,
} from '@/lib/directory-sitemap'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function toDate(value: any): Date | undefined {
  if (!value) return undefined
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined
}

async function buildDirectorySitemap(id: number): Promise<MetadataRoute.Sitemap> {
  try {
    const snap = await adminDb
      .collection('directory_listings')
      .where('is_published', '==', true)
      .orderBy(FieldPath.documentId())
      .offset(id * DIRECTORY_SITEMAP_PAGE_SIZE)
      .limit(DIRECTORY_SITEMAP_PAGE_SIZE)
      .select('updated_at', 'merged_into')
      .get()

    return snap.docs.flatMap((doc) => {
      const data = doc.data() as any
      if (data.merged_into) return []
      const path = `/directory/${doc.id}`
      return [{
        url: `${BASE}/en${path}`,
        lastModified: toDate(data.updated_at),
        alternates: {
          languages: {
            en: `${BASE}/en${path}`,
            es: `${BASE}/es${path}`,
            'x-default': `${BASE}/en${path}`,
          },
        },
      }]
    })
  } catch (error) {
    // NOT silent. An empty sitemap is indistinguishable from a working one to
    // everybody except a search engine, which simply indexes nothing and never
    // complains. A thrown query (a missing composite index, a permissions
    // change) must page someone rather than publish a valid-looking empty file.
    await reportFailure('directory-sitemap', error, { shard: id }).catch(() => {})
    return []
  }
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const pages = await getDirectorySitemapPageCount()
  return Array.from({ length: pages }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: number | string }): Promise<MetadataRoute.Sitemap> {
  const shard = parseShardId(id)
  if (shard === null) return []
  // An out-of-range shard returns empty rather than querying at a huge offset —
  // offset() bills a read per skipped document, so an probed /999.xml would cost
  // real money for nothing.
  const pages = await getDirectorySitemapPageCount().catch(() => 0)
  if (pages > 0 && shard >= pages) return []
  return unstable_cache(() => buildDirectorySitemap(shard), ['directory-sitemap-v2', String(shard)], {
    revalidate: 3600,
    tags: ['directory'],
  })()
}
