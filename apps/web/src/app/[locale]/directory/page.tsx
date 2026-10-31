import type { Metadata } from 'next'
import Link from 'next/link'
import { localeAlternates } from '@/lib/seo'
import { getNonEmptyCombos } from '@/lib/local-seo'
import DirectoryPageClient from './DirectoryPageClient'
import { categoryLabel } from '@/lib/categories'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
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
      <p className="mt-2 text-sm text-white/55">{isEs ? 'Elige una categoría para ver sus ciudades.' : 'Choose a category to see its cities.'}</p>
      <div className="mt-6 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(groups.values()).map(({ cat, cities }) => (
          <details key={cat.slug} className="rounded-xl border border-white/15 bg-white/5 p-4">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-brand-neon focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">{isEs ? categoryLabel(cat.value, locale) : cat.plural} <span className="text-white/55">({cities.length})</span></summary>
            <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
              {cities.map((city) => (
                <li key={`${cat.slug}:${city.slug}`}>
                  <Link
                    href={`/${locale}/best/${cat.slug}/${city.slug}`}
                    className="inline-flex min-h-11 items-center text-sm text-white/70 transition hover:text-brand-neon"
                  >
                    {isEs ? `${categoryLabel(cat.value, locale)} en ${city.name}` : `${cat.plural} in ${city.name}`}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}

export default async function DirectoryPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = params.locale === 'es' ? 'es' : 'en'
  return <DirectoryPageClient browseLinks={<BrowseByCategory locale={locale} />} />
}
