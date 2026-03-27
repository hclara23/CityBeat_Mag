'use client'

import { useEffect, useMemo, useState } from 'react'
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')

export default function NewArticlePage() {
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
  const [authorName, setAuthorName] = useState('')
  const [publishNow, setPublishNow] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => {
    return (
      titleEn &&
      titleEs &&
      slug &&
      excerptEn &&
      excerptEs &&
      contentEn &&
      contentEs &&
      categoryId
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

      setCategories(categoryData ?? [])
      setAuthors(authorData ?? [])
    }

    fetchMeta()
  }, [supabase])

  useEffect(() => {
    if (!slug && titleEn) {
      setSlug(slugify(titleEn))
    }
  }, [titleEn, slug])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You are no longer signed in.')
      setLoading(false)
      return
    }

    let resolvedAuthorId = authorId

    if (!resolvedAuthorId && authorName.trim()) {
      const { data: newAuthor, error: authorError } = await supabase
        .from('authors')
        .insert({ name: authorName.trim() })
        .select('id')
        .single()

      if (authorError || !newAuthor) {
        setError(authorError?.message ?? 'Unable to create author.')
        setLoading(false)
        return
      }

      resolvedAuthorId = newAuthor.id
    }

    if (!resolvedAuthorId) {
      setError('Select an author or create a new one.')
      setLoading(false)
      return
    }

    const { data: article, error: articleError } = await supabase
      .from('articles')
      .insert({
        slug,
        category_id: categoryId,
        author_id: resolvedAuthorId,
        created_by: user.id,
        published_at: publishNow ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (articleError || !article) {
      setError(articleError?.message ?? 'Unable to create article.')
      setLoading(false)
      return
    }

    const { error: translationError } = await supabase
      .from('article_translations')
      .insert([
        {
          article_id: article.id,
          locale: 'en',
          title: titleEn,
          excerpt: excerptEn,
          content: contentEn,
        },
        {
          article_id: article.id,
          locale: 'es',
          title: titleEs,
          excerpt: excerptEs,
          content: contentEs,
        },
      ])

    if (translationError) {
      setError(translationError.message)
      setLoading(false)
      return
    }

    if (coverFile) {
      const path = `articles/${article.id}/cover-${Date.now()}-${coverFile.name}`
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
        .eq('id', article.id)

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

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">New Article</h2>
        <p className="mt-2 text-sm text-ink/70">
          Create an English draft, upload a cover image, and publish when ready.
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
            {categories.length === 0 ? (
              <p className="mt-2 text-xs text-ink/50">
                No categories found. Seed categories in Supabase first.
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Existing Author
            </label>
            <select
              value={authorId}
              onChange={(event) => setAuthorId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            >
              <option value="">Create new author</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!authorId ? (
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              New Author Name
            </label>
            <input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            />
          </div>
        ) : null}

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Cover Image
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
          Publish immediately
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
          {loading ? 'Saving...' : 'Create Article'}
        </button>
      </form>
    </section>
  )
}
