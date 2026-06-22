import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale, type Locale } from '@/components/citybeat/content'
import { getPublishedArticles, CATEGORY_IDS } from '@/lib/articles'

export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string; category: string }
}

const categoryLabels: Record<string, { en: string; es: string }> = {
  news: { en: 'News', es: 'Noticias' },
  business: { en: 'Business', es: 'Negocios' },
  events: { en: 'Events', es: 'Eventos' },
  culture: { en: 'Culture', es: 'Cultura' },
}

export default async function TopicPage({ params }: Props) {
  const locale = (params.locale || 'en') as Locale
  const category = params.category

  if (!(CATEGORY_IDS as readonly string[]).includes(category)) {
    notFound()
  }

  const articles = await getPublishedArticles({ category, limit: 60 })

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <Link
          href={withLocale(locale, '/stories')}
          className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline"
        >
          {locale === 'es' ? '← Boletines' : '← Stories'}
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.28em] text-brand-neon">
          {locale === 'es' ? 'Tema' : 'Topic'}
        </p>
        <h1 className="mt-3 font-display text-5xl font-black tracking-tight text-white">
          {categoryLabels[category]?.[locale] ?? category}
        </h1>

        {articles.length === 0 ? (
          <p className="mt-16 text-white/55">
            {locale === 'es' ? 'No hay historias en este tema todavía.' : 'No stories in this topic yet.'}
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
                      {article.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-white/55">{article.excerpt}</p>
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
