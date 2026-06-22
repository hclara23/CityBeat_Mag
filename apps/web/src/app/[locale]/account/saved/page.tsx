import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale, type Locale } from '@/components/citybeat/content'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getArticleById, getArticleBySlug, type Article } from '@/lib/articles'

export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string }
}

export default async function SavedPage({ params }: Props) {
  const locale = (params.locale || 'en') as Locale
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/login?redirectTo=/${locale}/account/saved`)
  }

  let articles: Article[] = []
  try {
    const snap = await adminDb.collection('user_bookmarks').where('user_id', '==', user.id).get()
    const ids = snap.docs.map((d) => (d.data() as any).content_id).filter(Boolean)
    const resolved = await Promise.all(
      ids.map(async (id: string) => (await getArticleById(id)) || (await getArticleBySlug(id)))
    )
    articles = resolved.filter((a): a is Article => Boolean(a))
  } catch (error) {
    console.error('saved page error:', error)
  }

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <h1 className="font-display text-5xl font-black tracking-tight text-white">
          {locale === 'es' ? 'Guardados' : 'Saved'}
        </h1>
        <p className="mt-3 text-white/55">
          {locale === 'es' ? 'Tus historias guardadas.' : 'Your saved stories.'}
        </p>

        {articles.length === 0 ? (
          <p className="mt-16 text-white/55">
            {locale === 'es'
              ? 'Aún no has guardado ninguna historia.'
              : "You haven't saved any stories yet."}
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
                      className="aspect-[4/3] w-full object-cover opacity-85 transition duration-500 group-hover:scale-105"
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
