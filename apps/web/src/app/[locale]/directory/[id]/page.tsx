import type { Metadata } from 'next'
import { cache } from 'react'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { jsonLdSafe } from '@/lib/jsonld'
import { breadcrumbJsonLd } from '@/lib/seo'
import { stripInternalListingFields } from '@/lib/listing-fields'
import { activePosts, elPasoDayKey } from '@/lib/listing-content'
import DirectoryDetailClient from './DirectoryDetailClient'

// ISR: cache the rendered page for 15 min. (Was force-dynamic, which silently
// overrode this revalidate — every crawl of all ~6,700 listings re-read Firestore.)
export const revalidate = 900

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Params = { locale: string; id: string }

// Server-side fetch of the listing so metadata + schema live in the INITIAL
// HTML (a client component can't do that). This is what makes each business
// page actually rank and show rich results — the core of the Premium SEO perk.
// cache() dedupes the read across generateMetadata + the component within one
// request, so each business page hits Firestore once instead of twice.
const getListing = cache(async (id: string): Promise<any | null> => {
  try {
    const doc = await adminDb.collection('directory_listings').doc(id).get()
    return doc.exists ? { id: doc.id, ...(doc.data() as any) } : null
  } catch {
    return null
  }
})

type FirstPartyReview = { rating: number; comment: string; author: string; datePublished: string | null }

// First-party reviews for schema. We only ever mark up reviews CityBeat itself
// collected (directory_reviews) — never the imported Google Places rating, which
// is both a data mismatch (won't match on-page reviews) and a structured-data
// manual-action risk. Bounded to the 15 most recent and their author names.
async function getFirstPartyReviews(
  id: string
): Promise<{ reviews: FirstPartyReview[]; count: number; average: number }> {
  try {
    const snap = await adminDb.collection('directory_reviews').where('listing_id', '==', id).get()
    const raw = snap.docs
      .map((d) => d.data() as any)
      .filter((r) => Number.isFinite(Number(r.rating)) && Number(r.rating) >= 1 && Number(r.rating) <= 5)
    if (raw.length === 0) return { reviews: [], count: 0, average: 0 }

    const count = raw.length
    const average = Math.round((raw.reduce((s, r) => s + Number(r.rating), 0) / count) * 10) / 10

    const recent = raw
      .map((r) => ({
        ...r,
        _ts:
          typeof r.created_at?.toDate === 'function'
            ? r.created_at.toDate().getTime()
            : Date.parse(r.created_at) || 0,
      }))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 15)

    // Resolve author names in one batched read.
    const uids = Array.from(new Set(recent.map((r) => r.user_id).filter(Boolean)))
    const nameByUid = new Map<string, string>()
    if (uids.length) {
      const refs = uids.map((u) => adminDb.collection('profiles').doc(String(u)))
      const profiles = await adminDb.getAll(...refs)
      profiles.forEach((p) => {
        if (p.exists) nameByUid.set(p.id, (p.data() as any)?.full_name || 'CityBeat reader')
      })
    }

    const reviews: FirstPartyReview[] = recent
      .filter((r) => typeof r.comment === 'string' && r.comment.trim())
      .map((r) => ({
        rating: Number(r.rating),
        comment: String(r.comment).slice(0, 500),
        author: nameByUid.get(String(r.user_id)) || 'CityBeat reader',
        datePublished: r._ts ? new Date(r._ts).toISOString() : null,
      }))

    return { reviews, count, average }
  } catch {
    return { reviews: [], count: 0, average: 0 }
  }
}

// Deep-convert Firestore data (Timestamps → ISO) to plain JSON so it can cross
// the server→client boundary as a prop (Next.js rejects class instances).
function toPlain(v: any): any {
  if (v == null) return v
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(toPlain)
  if (typeof v === 'object') {
    const o: any = {}
    for (const k of Object.keys(v)) o[k] = toPlain(v[k])
    return o
  }
  return v
}

function toPublicListing(listing: any) {
  const plain = stripInternalListingFields(toPlain(listing))
  // Scheduled/expired posts stay private until they go live.
  plain.posts = activePosts(plain.posts, elPasoDayKey(new Date()))
  return plain
}

function cityFromAddress(address?: string | null): string | null {
  if (!address) return null
  // ".., El Paso, TX 79902" → "El Paso"
  const m = address.match(/,\s*([^,]+),\s*(?:TX|NM|Texas|New Mexico|Chih\.?|CHIH)\b/i)
  return m ? m[1].trim() : null
}

const DAY_MAP: Record<string, string> = {
  Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su',
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const listing = await getListing(params.id)
  if (!listing) return { title: 'Business not found · CityBeat' }

  const locale = params.locale === 'es' ? 'es' : 'en'
  const city = cityFromAddress(listing.address) || 'El Paso'
  const cat = listing.category || 'Local Business'
  const name = listing.name || 'Local Business'
  const url = `${BASE}/${locale}/directory/${listing.id}`

  const title = `${name} — ${cat} in ${city} | CityBeat`
  // Prefer real Spanish copy on the ES page (El Paso is ~90% Spanish-speaking).
  const rawDesc = locale === 'es' ? listing.description_es || listing.description : listing.description
  const description =
    (typeof rawDesc === 'string' && rawDesc.trim().slice(0, 155)) ||
    (locale === 'es'
      ? `${name} es un negocio de ${cat.toLowerCase()} en ${city}. Ve horarios, fotos, reseñas y contacto en CityBeat.`
      : `${name} is a ${cat.toLowerCase()} in ${city}. See hours, photos, reviews, and contact info on CityBeat.`)

  const image = listing.image_url || `${BASE}/api/og?title=${encodeURIComponent(name)}&eyebrow=${encodeURIComponent(cat)}`
  // Only index published listings; keep unpublished/merged out of the index.
  const indexable = listing.is_published !== false && !listing.merged_into

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: `${BASE}/en/directory/${listing.id}`,
        es: `${BASE}/es/directory/${listing.id}`,
      },
    },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: image }],
      siteName: 'CityBeat',
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

function buildSchema(
  listing: any,
  locale: string,
  reviewData: { reviews: FirstPartyReview[]; count: number; average: number }
) {
  const url = `${BASE}/${locale}/directory/${listing.id}`
  const social = listing.social_links || {}
  const sameAs = [social.facebook, social.instagram, social.twitter, listing.website].filter(Boolean)
  const schemaDesc = locale === 'es' ? listing.description_es || listing.description : listing.description
  // Service areas (GMB parity) → schema areaServed.
  const areaServed = Array.isArray(listing.service_areas)
    ? listing.service_areas.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 20)
    : []

  // hours: { Monday: "9:00 AM - 5:00 PM", ... } → schema openingHours strings.
  let openingHours: string[] | undefined
  if (listing.hours && typeof listing.hours === 'object') {
    openingHours = Object.entries(listing.hours as Record<string, string>)
      .map(([day, val]) => {
        const d = DAY_MAP[day]
        if (!d || !val || /closed/i.test(val)) return null
        return `${d} ${val}`
      })
      .filter(Boolean) as string[]
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name: listing.name,
    url,
    ...(schemaDesc ? { description: String(schemaDesc).slice(0, 500) } : {}),
    ...(listing.image_url ? { image: [listing.image_url, ...(Array.isArray(listing.gallery_urls) ? listing.gallery_urls.slice(0, 5) : [])] } : {}),
    ...(listing.phone ? { telephone: listing.phone } : {}),
    ...(listing.address
      ? { address: { '@type': 'PostalAddress', streetAddress: listing.address, addressLocality: cityFromAddress(listing.address) || 'El Paso', addressRegion: 'TX', addressCountry: 'US' } }
      : {}),
    ...(typeof listing.latitude === 'number' && typeof listing.longitude === 'number'
      ? { geo: { '@type': 'GeoCoordinates', latitude: listing.latitude, longitude: listing.longitude } }
      : {}),
    ...(openingHours && openingHours.length ? { openingHours } : {}),
    ...(areaServed.length ? { areaServed } : {}),
    ...(listing.video_url ? { video: { '@type': 'VideoObject', name: listing.name, contentUrl: listing.video_url } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    // Aggregate + individual reviews come ONLY from first-party reviews we
    // actually collected and render on the page — never the imported Google
    // Places numbers (mismatch + manual-action risk).
    ...(reviewData.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: reviewData.average,
            reviewCount: reviewData.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviewData.reviews.length
      ? {
          review: reviewData.reviews.map((r) => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            author: { '@type': 'Person', name: r.author },
            ...(r.datePublished ? { datePublished: r.datePublished } : {}),
            reviewBody: r.comment,
          })),
        }
      : {}),
  }
}

export default async function DirectoryDetailPage({ params }: { params: Params }) {
  const listing = await getListing(params.id)
  const locale = params.locale === 'es' ? 'es' : 'en'
  const indexable = listing && listing.is_published !== false && !listing.merged_into
  const reviewData = indexable
    ? await getFirstPartyReviews(params.id)
    : { reviews: [], count: 0, average: 0 }

  const breadcrumb = listing
    ? breadcrumbJsonLd(locale, [
        { name: locale === 'es' ? 'Inicio' : 'Home', path: '/' },
        { name: locale === 'es' ? 'Directorio' : 'Directory', path: '/directory' },
        { name: listing.name || 'Business' },
      ])
    : null

  return (
    <>
      {indexable && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildSchema(listing, locale, reviewData)) }}
          />
          {breadcrumb && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(breadcrumb) }} />
          )}
        </>
      )}
      <DirectoryDetailClient initialListing={listing ? toPublicListing(listing) : null} />
    </>
  )
}
