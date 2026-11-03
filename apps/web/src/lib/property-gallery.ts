import type { ApartmentResearch } from './apartment-enrichment'
import { listingWebsiteHref } from './listing-outbound'

/** Public photo projection for approved manager edits, including newly imported rentals. */
export function managedPropertyResearch(data: Record<string, unknown>, website: string, fallback?: ApartmentResearch): ApartmentResearch | undefined {
  if (!Array.isArray(data.gallery_urls)) return fallback
  const source = listingWebsiteHref(typeof data.property_gallery_source === 'string' ? data.property_gallery_source : '') || website
  const photos = data.gallery_urls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url) && !!listingWebsiteHref(url)).slice(0, 30).map(url =>
    fallback?.photos.find(photo => photo.url === url) || { url, sourceUrl: source,
      caption: { en: 'Photo reviewed and supplied by the listing manager', es: 'Foto revisada y proporcionada por la administración' } })
  if (!photos.length && !fallback) return undefined
  return { ...(fallback || { summary: { en: String(data.description || ''), es: String(data.description_es || '') }, highlights: { en: [], es: [] }, sources: [source] }),
    checkedAt: fallback?.checkedAt || String(data.property_gallery_reviewed_at || data.updated_at || '').slice(0, 10), photos }
}
