import type { Metadata } from 'next'
import Link from 'next/link'
import { localeAlternates } from '@/lib/seo'
import { getNonEmptyCombos } from '@/lib/local-seo'
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

// Server-rendered "browse by category & city" block. It lives in the INITIAL
// SSR HTML (the listings themselves load client-side), giving the head-term hub
// crawlable, keyword-rich internal links to the /best money pages — which were
// otherwise orphaned (only one footer link reached them). getNonEmptyCombos is
// unstable_cache'd, so this adds no per-request read.
async function BrowseByCategory({ locale }: { locale: string }) {
  let combos: Awaited<ReturnType<typeof getNonEmptyCombos>> = []
  try {
    combos = await getNonEmptyCombos()
  } catch {
    combos = []
  }
  if (!combos.length) return null
  const isEs = locale === 'es'
  const groups = new Map<string, { cat: (typeof combos)[number]['category']; cities: (typeof combos)[number]['city'][] }>()
  for (const { category, city } of combos) {
    const g = groups.get(category.slug) || { cat: category, cities: [] }
    g.cities.push(city)
    groups.set(category.slug, g)
  }

  return (
    <section className="container-wide max-w-6xl border-t border-white/10 py-16">
      <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">
        {isEs ? 'Explora por categoría y ciudad' : 'Browse by category & city'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-white/55">
        {isEs
          ? 'Guías locales de los mejores negocios en El Paso, Las Cruces y la región fronteriza.'
          : 'Local guides to the best businesses across El Paso, Las Cruces, and the borderland.'}
      </p>
      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(groups.values()).map(({ cat, cities }) => (
          <div key={cat.slug}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">{cat.plural}</h3>
            <ul className="mt-2 space-y-1">
              {cities.map((city) => (
                <li key={`${cat.slug}:${city.slug}`}>
                  <Link
                    href={`/${locale}/best/${cat.slug}/${city.slug}`}
                    className="text-sm text-white/70 transition hover:text-brand-neon"
                  >
                    {isEs ? `Mejores ${cat.plural} en ${city.name}` : `Best ${cat.plural} in ${city.name}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function DirectoryPage({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  return <DirectoryPageClient browseLinks={<BrowseByCategory locale={locale} />} />
}
