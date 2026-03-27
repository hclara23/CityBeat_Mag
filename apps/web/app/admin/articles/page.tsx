import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

type ArticleRow = {
  id: string
  slug: string
  published_at: string | null
  author?: { name: string }[]
  category?: { name_en: string }[]
  translations?: { locale: string; title: string }[]
}

export default async function AdminArticlesPage() {
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select(
      `
        id,
        slug,
        published_at,
        author:authors(name),
        category:categories(name_en),
        translations:article_translations(locale, title)
      `
    )
    .order('created_at', { ascending: false })

  const list = (articles ?? []) as unknown as ArticleRow[]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Articles</h2>
        <Link
          href="/admin/articles/new"
          className="rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
        >
          New Article
        </Link>
      </div>

      <div className="space-y-3">
        {list.map((article) => {
          const translation = article.translations?.find(
            (item) => item.locale === 'en'
          )

          return (
            <div
              key={article.id}
              className="rounded-2xl border border-ink/10 bg-white/80 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
                    {article.category?.[0]?.name_en ?? 'Uncategorized'}
                  </p>
                  <h3 className="mt-2 font-display text-xl">
                    {translation?.title ?? 'Untitled'}
                  </h3>
                  <p className="mt-1 text-sm text-ink/70">
                    {article.author?.[0]?.name ?? 'CityBeat Staff'}
                  </p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.2em] text-ink/60">
                  {article.published_at ? (
                    <span>
                      Published{' '}
                      {new Date(article.published_at).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )}
                    </span>
                  ) : (
                    <span>Draft</span>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs uppercase tracking-[0.2em]">
                <Link
                  href={`/en/article/${article.slug}`}
                  className="text-ink/60 hover:text-ink"
                >
                  View
                </Link>
                <Link
                  href={`/admin/articles/${article.id}`}
                  className="text-ink/60 hover:text-ink"
                >
                  Edit
                </Link>
              </div>
            </div>
          )
        })}
        {list.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 text-sm text-ink/70">
            No articles yet. Create the first one.
          </div>
        ) : null}
      </div>
    </section>
  )
}
