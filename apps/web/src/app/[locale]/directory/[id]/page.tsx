import type { Metadata } from 'next'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { jsonLdSafe } from '@/lib/jsonld'
import DirectoryDetailClient from './DirectoryDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 900

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Params = { locale: string; id: string }

// Server-side fetch of the listing so metadata + schema live in the INITIAL
// HTML (a client component can't do that). This is what makes each business
// page actually rank and show rich results — the core of the Premium SEO perk.
async function getListing(id: string): Promise<any | null> {
  try {
    const doc = await adminDb.collection('directory_listings').doc(id).get()
    return doc.exists ? { id: doc.id, ...(doc.data() as any) } : null
  } catch {
    return null
  }
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

function buildSchema(listing: any, locale: string) {
  const url = `${BASE}/${locale}/directory/${listing.id}`
  const social = listing.social_links || {}
  const sameAs = [social.facebook, social.instagram, social.twitter, listing.website].filter(Boolean)
  const schemaDesc = locale === 'es' ? listing.description_es || listing.description : listing.description

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
    ...(sameAs.length ? { sameAs } : {}),
    ...(listing.rating && listing.user_ratings_total
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: listing.rating, reviewCount: listing.user_ratings_total } }
      : {}),
  }
}

export default async function DirectoryDetailPage({ params }: { params: Params }) {
  const listing = await getListing(params.id)
  const locale = params.locale === 'es' ? 'es' : 'en'

  return (
    <>
      {listing && listing.is_published !== false && !listing.merged_into && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(buildSchema(listing, locale)) }} />
      )}
      <DirectoryDetailClient />
    </>
  )
}
