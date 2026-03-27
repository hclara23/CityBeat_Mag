'use client'

import { useEffect, useMemo, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { ARTICLE_BUCKET } from '@/src/lib/supabase/constants'

type Category = {
  id: string
  name_en: string
}

type Author = {
  id: string
  name: string
}

type Translation = {
  locale: string
  title: string
  excerpt: string
  content: string
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')

export default function EditArticlePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [categories, setCategories] = useState<Category[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [titleEn, setTitleEn] = useState('')
  const [titleEs, setTitleEs] = useState('')
  const [slug, setSlug] = useState('')
  const [excerptEn, setExcerptEn] = useState('')
  const [excerptEs, setExcerptEs] = useState('')
  const [contentEn, setContentEn] = useState('')
  const [contentEs, setContentEs] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [authorId, setAuthorId] = useState('')
  const [publishNow, setPublishNow] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const canSubmit = useMemo(() => {
    return (
      titleEn &&
      titleEs &&
      slug &&
      excerptEn &&
      excerptEs &&
      contentEn &&
      contentEs &&
      categoryId &&
      authorId
    )
  }, [
    titleEn,
    titleEs,
    slug,
    excerptEn,
    excerptEs,
    contentEn,
    contentEs,
    categoryId,
    authorId,
  ])

  useEffect(() => {
    const fetchMeta = async () => {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name_en')
        .order('name_en')

      const { data: authorData } = await supabase
        .from('authors')
        .select('id, name')
        .order('name')

      const { data: article, error: articleError } = await supabase
        .from('articles')
        .select(
          `
            id,
            slug,
            category_id,
            author_id,
            published_at,
            translations:article_translations(locale, title, excerpt, content)
          `
        )
        .eq('id', params.id)
        .maybeSingle()

      if (articleError || !article) {
        setError(articleError?.message ?? 'Unable to load article.')
        setLoadingData(false)
        return
      }

      const translations = (article.translations ?? []) as Translation[]
      const en = translations.find((item) => item.locale === 'en')
      const es = translations.find((item) => item.locale === 'es')

      setCategories(categoryData ?? [])
      setAuthors(authorData ?? [])
      setSlug(article.slug)
      setCategoryId(article.category_id)
      setAuthorId(article.author_id)
      setPublishNow(Boolean(article.published_at))
      setTitleEn(en?.title ?? '')
      setExcerptEn(en?.excerpt ?? '')
      setContentEn(en?.content ?? '')
      setTitleEs(es?.title ?? '')
      setExcerptEs(es?.excerpt ?? '')
      setContentEs(es?.content ?? '')
      setLoadingData(false)
    }

    fetchMeta()
  }, [params.id, supabase])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        slug: slugify(slug),
        category_id: categoryId,
        author_id: authorId,
        published_at: publishNow ? new Date().toISOString() : null,
      })
      .eq('id', params.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { error: translationError } = await supabase
      .from('article_translations')
      .upsert(
        [
          {
            article_id: params.id,
            locale: 'en',
            title: titleEn,
            excerpt: excerptEn,
            content: contentEn,
          },
          {
            article_id: params.id,
            locale: 'es',
            title: titleEs,
            excerpt: excerptEs,
            content: contentEs,
          },
        ],
        { onConflict: 'article_id,locale' }
      )

    if (translationError) {
      setError(translationError.message)
      setLoading(false)
      return
    }

    if (coverFile) {
      const path = `articles/${params.id}/cover-${Date.now()}-${coverFile.name}`
      const { error: uploadError } = await supabase.storage
        .from(ARTICLE_BUCKET)
        .upload(path, coverFile, { upsert: true })

      if (uploadError) {
        setError(uploadError.message)
        setLoading(false)
        return
      }

      const { error: coverUpdateError } = await supabase
        .from('articles')
        .update({ cover_image_path: path })
        .eq('id', params.id)

      if (coverUpdateError) {
        setError(coverUpdateError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    router.push('/admin/articles')
    router.refresh()
  }

  if (loadingData) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white/80 p-6">
        Loading...
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Edit Article</h2>
        <p className="mt-2 text-sm text-ink/70">
          Update bilingual content, category, and publish state.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-ink/10 bg-white/80 p-6"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Title (EN)
            </label>
            <input
              value={titleEn}
              onChange={(event) => setTitleEn(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Title (ES)
            </label>
            <input
              value={titleEs}
              onChange={(event) => setTitleEs(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Slug
          </label>
          <input
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Excerpt (EN)
            </label>
            <textarea
              value={excerptEn}
              onChange={(event) => setExcerptEn(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Excerpt (ES)
            </label>
            <textarea
              value={excerptEs}
              onChange={(event) => setExcerptEs(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              rows={3}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Content (EN)
            </label>
            <textarea
              value={contentEn}
              onChange={(event) => setContentEn(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              rows={10}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Content (ES)
            </label>
            <textarea
              value={contentEs}
              onChange={(event) => setContentEs(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              rows={10}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Author
            </label>
            <select
              value={authorId}
              onChange={(event) => setAuthorId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            >
              <option value="">Select author</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Cover Image (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
          />
        </div>

        <label className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-ink/60">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
            className="h-4 w-4"
          />
          Published
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-lg bg-ink px-4 py-3 text-xs uppercase tracking-[0.25em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </section>
  )
}
