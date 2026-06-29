import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import {
  LOCAL_CATEGORIES,
  LOCAL_CITIES,
  findCategory,
  findCity,
  getLocalListings,
} from '@/lib/local-seo'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Params = { locale: string; category: string; city: string }

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const cat = findCategory(params.category)
  const city = findCity(params.city)
  if (!cat || !city) return { title: 'Not found · CityBeat' }
  const isEs = params.locale === 'es'
  const title = isEs
    ? `Mejores ${cat.plural} en ${city.name} · CityBeat`
    : `Best ${cat.plural} in ${city.name} · CityBeat`
  const description = isEs
    ? `Guía local de ${cat.plural.toLowerCase()} en ${city.name}: reseñas, horarios y contacto en CityBeat, el directorio bilingüe de la frontera.`
    : `Your local guide to ${cat.plural.toLowerCase()} in ${city.name} — reviews, hours, and contact info on CityBeat, the borderland's bilingual directory.`
  const url = `${BASE}/${params.locale}/best/${cat.slug}/${city.slug}`
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: `${BASE}/en/best/${cat.slug}/${city.slug}`,
        es: `${BASE}/es/best/${cat.slug}/${city.slug}`,
      },
    },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function LocalBestPage({ params }: { params: Params }) {
  const cat = findCategory(params.category)
  const city = findCity(params.city)
  if (!cat || !city) notFound()
  const isEs = params.locale === 'es'

  const listings = await getLocalListings(cat, city)
  // Never index a thin/empty page.
  if (listings.length === 0) notFound()

  const heading = isEs ? `Mejores ${cat.plural} en ${city.name}` : `Best ${cat.plural} in ${city.name}`
  const intro = isEs
    ? `${listings.length} ${cat.plural.toLowerCase()} en ${city.name}, clasificados por destacados y reseñas. Actualizado por CityBeat.`
    : `${listings.length} ${cat.plural.toLowerCase()} in ${city.name}, ranked by featured status and reviews. Kept current by CityBeat.`

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    itemListElement: listings.slice(0, 30).map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/${params.locale}/directory/${l.id}`,
      name: l.name,
    })),
  }
  const jsonLd = JSON.stringify(itemList).replace(/</g, '\\u003c')

  const otherCities = LOCAL_CITIES.filter((c) => c.slug !== city.slug)
  const otherCats = LOCAL_CATEGORIES.filter((c) => c.slug !== cat.slug)

  return (
    <CityBeatShell locale={params.locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <section className="container-wide max-w-4xl py-14">
        <Link
          href={withLocale(params.locale, '/directory')}
          className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline"
        >
          {isEs ? '← Directorio' : '← Directory'}
        </Link>

        <h1 className="mt-4 font-display text-4xl font-black tracking-tight text-white md:text-5xl">{heading}</h1>
        <p className="mt-3 max-w-2xl text-white/60">{intro}</p>

        <ol className="mt-8 space-y-4">
          {listings.map((l, i) => (
            <li key={l.id}>
              <Link
                href={withLocale(params.locale, `/directory/${l.id}`)}
                className="group flex gap-4 rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-neon/40 hover:bg-brand-neon/5"
              >
                <span className="font-display text-2xl font-black text-white/30">{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-white group-hover:text-brand-neon">{l.name}</span>
                    {l.is_sponsored && (
                      <span className="rounded bg-brand-gold/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-brand-gold">
                        {isEs ? 'Destacado' : 'Sponsored'}
                      </span>
                    )}
                  </span>
                  {l.address && <span className="mt-0.5 block truncate text-sm text-white/45">{l.address}</span>}
                  {typeof l.rating === 'number' && l.rating > 0 && (
                    <span className="mt-1 block text-xs text-white/55">
                      ★ {l.rating.toFixed(1)}
                      {l.user_ratings_total ? ` · ${l.user_ratings_total} ${isEs ? 'reseñas' : 'reviews'}` : ''}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {/* Internal linking: same category in other cities, and other categories here */}
        <nav className="mt-12 grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
              {isEs ? `${cat.plural} en otras ciudades` : `${cat.plural} in other cities`}
            </p>
            <ul className="space-y-1.5">
              {otherCities.map((c) => (
                <li key={c.slug}>
                  <Link href={withLocale(params.locale, `/best/${cat.slug}/${c.slug}`)} className="text-sm text-brand-neon hover:underline">
                    {isEs ? `${cat.plural} en ${c.name}` : `${cat.plural} in ${c.name}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
              {isEs ? `Más en ${city.name}` : `More in ${city.name}`}
            </p>
            <ul className="space-y-1.5">
              {otherCats.map((c) => (
                <li key={c.slug}>
                  <Link href={withLocale(params.locale, `/best/${c.slug}/${city.slug}`)} className="text-sm text-brand-neon hover:underline">
                    {isEs ? `${c.plural} en ${city.name}` : `${c.plural} in ${city.name}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="mt-10 rounded-xl border border-brand-neon/30 bg-brand-neon/5 p-6">
          <p className="font-display text-lg font-bold text-white">
            {isEs ? `¿Tienes un negocio en ${city.name}?` : `Own a business in ${city.name}?`}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {isEs
              ? 'Reclama tu ficha gratis y destácate ante miles de lectores locales.'
              : 'Claim your free listing and get featured in front of thousands of local readers.'}
          </p>
          <Link
            href={withLocale(params.locale, '/directory')}
            className="mt-4 inline-block rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
          >
            {isEs ? 'Reclamar mi negocio' : 'Claim my business'}
          </Link>
        </div>
      </section>
    </CityBeatShell>
  )
}
