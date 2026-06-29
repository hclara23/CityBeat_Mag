import type { Metadata } from 'next'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { getNonEmptyCombos } from '@/lib/local-seo'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const isEs = params.locale === 'es'
  const title = isEs ? 'Mejores negocios locales · CityBeat' : 'Best local businesses · CityBeat'
  const description = isEs
    ? 'Guías locales por categoría y ciudad en El Paso, Las Cruces y Ciudad Juárez.'
    : 'Local guides by category and city across El Paso, Las Cruces, and Ciudad Juárez.'
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/${params.locale}/best` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function BestHub({ params }: { params: { locale: string } }) {
  const isEs = params.locale === 'es'
  const combos = await getNonEmptyCombos()

  // group by city for a scannable layout
  const byCity = new Map<string, { name: string; items: typeof combos }>()
  for (const c of combos) {
    const key = c.city.slug
    if (!byCity.has(key)) byCity.set(key, { name: c.city.name, items: [] })
    byCity.get(key)!.items.push(c)
  }

  return (
    <CityBeatShell locale={params.locale}>
      <section className="container-wide max-w-4xl py-14">
        <h1 className="font-display text-4xl font-black tracking-tight text-white md:text-5xl">
          {isEs ? 'Mejores negocios locales' : 'Best local businesses'}
        </h1>
        <p className="mt-3 max-w-2xl text-white/60">
          {isEs
            ? 'Explora por categoría y ciudad en El Paso, Las Cruces y Ciudad Juárez.'
            : 'Browse by category and city across El Paso, Las Cruces, and Ciudad Juárez.'}
        </p>

        {byCity.size === 0 ? (
          <p className="mt-10 text-white/45">{isEs ? 'Pronto disponible.' : 'Coming soon.'}</p>
        ) : (
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {[...byCity.values()].map((group) => (
              <div key={group.name}>
                <p className="mb-3 font-display text-lg font-black text-white">{group.name}</p>
                <ul className="space-y-1.5">
                  {group.items.map((c) => (
                    <li key={`${c.category.slug}-${c.city.slug}`}>
                      <Link
                        href={withLocale(params.locale, `/best/${c.category.slug}/${c.city.slug}`)}
                        className="text-sm text-brand-neon hover:underline"
                      >
                        {isEs ? `${c.category.plural} en ${c.city.name}` : `${c.category.plural} in ${c.city.name}`}
                        <span className="text-white/30"> · {c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
