import Image from 'next/image'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale, type Locale } from '@/components/citybeat/content'
import { getPublishedArticles, CATEGORY_IDS } from '@/lib/articles'

export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string }
  searchParams: { category?: string }
}

const categoryLabels: Record<string, { en: string; es: string }> = {
  all: { en: 'All', es: 'Todos' },
  news: { en: 'News', es: 'Noticias' },
  business: { en: 'Business', es: 'Negocios' },
  events: { en: 'Events', es: 'Eventos' },
  culture: { en: 'Culture', es: 'Cultura' },
}

export default async function StoriesPage({ params, searchParams }: Props) {
  const locale = (params.locale || 'en') as Locale
  const selected =
    searchParams.category && (CATEGORY_IDS as readonly string[]).includes(searchParams.category)
      ? searchParams.category
      : undefined

  const articles = await getPublishedArticles({ category: selected, limit: 60 })
  const tabs = ['all', ...CATEGORY_IDS]

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">
          {locale === 'es' ? 'CityBeat' : 'CityBeat'}
        </p>
        <h1 className="mt-3 font-display text-5xl font-black tracking-tight text-white">
          {locale === 'es' ? 'Boletines' : 'Stories'}
        </h1>

        <div className="mt-8 flex flex-wrap gap-3">
          {tabs.map((cat) => {
            const isActive = (cat === 'all' && !selected) || cat === selected
            const href = cat === 'all' ? '/stories' : `/stories?category=${cat}`
            return (
              <Link
                key={cat}
                href={withLocale(locale, href)}
                className={`rounded-md border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  isActive
                    ? 'border-brand-neon bg-brand-neon text-black'
                    : 'border-white/15 text-white/70 hover:border-brand-neon hover:text-brand-neon'
                }`}
              >
                {categoryLabels[cat]?.[locale] ?? cat}
              </Link>
            )
          })}
        </div>

        {articles.length === 0 ? (
          <p className="mt-16 text-white/55">
            {locale === 'es' ? 'No hay historias todavía.' : 'No stories yet.'}
          </p>
        ) : (
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article._id}
                href={withLocale(locale, `/stories/${article.slug}`)}
                className="group"
              >
                <article className="grid gap-4">
                  <div className="overflow-hidden rounded-md bg-white/5">
                    <Image
                      src={article.image ?? 'https://picsum.photos/seed/citybeat-local/1600/1000'}
                      alt=""
                      width={900}
                      height={650}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="aspect-[4/3] w-full object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">
                      {article.category}
                    </p>
                    <h2 className="mt-2 text-2xl font-black leading-tight text-white transition group-hover:text-brand-neon">
                      {locale === 'es' ? article.titleES : article.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-white/55">
                      {locale === 'es' ? article.excerptES : article.excerpt}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
