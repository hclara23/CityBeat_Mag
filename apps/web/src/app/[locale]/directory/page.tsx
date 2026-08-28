import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo'
import DirectoryPageClient from './DirectoryPageClient'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const isEs = params.locale === 'es'
  const title = isEs
    ? 'Directorio de negocios de El Paso · CityBeat'
    : 'El Paso Business Directory · CityBeat'
  const description = isEs
    ? 'Encuentra negocios locales en El Paso, Horizon, Socorro y Las Cruces: horarios, reseñas, fotos y contacto. Reclama o anuncia tu negocio en CityBeat.'
    : 'Find local businesses across El Paso, Horizon, Socorro, and Las Cruces — hours, reviews, photos, and contact info. Claim or advertise your business on CityBeat.'
  return {
    title,
    description,
    alternates: localeAlternates(params.locale, '/directory'),
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: `/api/og?title=${encodeURIComponent(isEs ? 'Directorio de negocios de El Paso' : 'El Paso Business Directory')}&eyebrow=${encodeURIComponent(isEs ? 'Directorio' : 'Directory')}` }],
    },
  }
}

// Every other public page (home, stories, events) declares this. This page
// never did, so Next.js statically prerendered it once at build time and
// Fastly (Firebase Hosting's CDN) cached that single snapshot for its
// default s-maxage — up to a year — so code changes here (categories, the
// search-icon fix, the result cap) could sit invisible to real visitors long
// after deploying. All of this page's actual content loads client-side
// anyway (see DirectoryPageClient's fetch), so the static shell was never
// buying real performance, only staleness. `dynamic` only takes effect from
// a Server Component, which is why it's split out here rather than declared
// alongside the 'use client' page content.
export const dynamic = 'force-dynamic'

export default function DirectoryPage() {
  return <DirectoryPageClient />
}
