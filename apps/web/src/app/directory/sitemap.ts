import type { MetadataRoute } from 'next'
import { FieldPath } from 'firebase-admin/firestore'
import { unstable_cache } from 'next/cache'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { DIRECTORY_SITEMAP_PAGE_SIZE, getDirectorySitemapPageCount } from '@/lib/directory-sitemap'

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
  } catch {
    return []
  }
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const pages = await getDirectorySitemapPageCount()
  return Array.from({ length: pages }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  if (!Number.isInteger(id) || id < 0) return []
  return unstable_cache(() => buildDirectorySitemap(id), ['directory-sitemap-v1', String(id)], {
    revalidate: 3600,
    tags: ['directory'],
  })()
}
