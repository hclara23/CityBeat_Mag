'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/supabase/auth'

type ArticleStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published'

interface Article {
  _id: string
  _createdAt: string
  title: string
  slug?: { current: string }
  excerpt?: string
  category?: string
  tags?: string[]
  status: ArticleStatus
  publishedAt?: string
  imageUrl?: string
}

const STATUS_CONFIG: Record<ArticleStatus, { label: string; color: string }> = {
  draft:          { label: 'Draft',       color: 'bg-white/10 text-white/60' },
  pending_review: { label: 'In Review',   color: 'bg-amber-500/20 text-amber-300' },
  approved:       { label: 'Approved',    color: 'bg-green-500/20 text-green-300' },
  rejected:       { label: 'Needs Edits', color: 'bg-red-500/20 text-red-300' },
  published:      { label: 'Published',   color: 'bg-brand-neon/20 text-brand-neon' },
}

const copy = {
  en: {
    title: 'Creator Dashboard',
    subtitle: 'Manage your articles and submissions',
    newArticle: 'New Article',
    articles: 'Your Articles',
    empty: "You haven't written anything yet.",
    emptyHint: 'Start with your first article — tell El Paso\'s story.',
    write: 'Write Your First Article',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this article?',
    category: 'Category',
    created: 'Created',
    filterAll: 'All',
    loading: 'Loading…',
  },
  es: {
    title: 'Panel de Creador',
    subtitle: 'Gestiona tus artículos y envíos',
    newArticle: 'Nuevo Artículo',
    articles: 'Tus Artículos',
    empty: 'Aún no has escrito nada.',
    emptyHint: 'Comienza con tu primer artículo — cuenta la historia de El Paso.',
    write: 'Escribe Tu Primer Artículo',
    edit: 'Editar',
    delete: 'Eliminar',
    deleteConfirm: '¿Seguro que deseas eliminar este artículo?',
    category: 'Categoría',
    created: 'Creado',
    filterAll: 'Todos',
    loading: 'Cargando…',
  },
}

export default function CreatorDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const t = copy[locale]

  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<ArticleStatus | 'all'>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadArticles = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/creator/articles${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setArticles(data.articles ?? [])
    } catch {
      setArticles([])
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) router.push(withLocale(locale, '/login'))
    })
  }, [router, locale])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return
    setDeleting(id)
    try {
      await fetch(`/api/creator/articles/${id}`, { method: 'DELETE' })
      setArticles((prev) => prev.filter((a) => a._id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const counts = {
    all: articles.length,
    draft: articles.filter((a) => a.status === 'draft').length,
    pending_review: articles.filter((a) => a.status === 'pending_review').length,
    published: articles.filter((a) => a.status === 'published').length,
    rejected: articles.filter((a) => a.status === 'rejected').length,
    approved: articles.filter((a) => a.status === 'approved').length,
  }

  const visible = filter === 'all' ? articles : articles.filter((a) => a.status === filter)

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-white/50">{t.subtitle}</p>
          </div>
          <Link
            href={withLocale(locale, '/creator/new')}
            className="inline-flex items-center gap-2 rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
          >
            <span>+</span> {t.newArticle}
          </Link>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'draft' as const, label: copy[locale].filterAll === 'All' ? 'Drafts' : 'Borradores' },
            { key: 'pending_review' as const, label: copy[locale].filterAll === 'All' ? 'In Review' : 'En Revisión' },
            { key: 'rejected' as const, label: copy[locale].filterAll === 'All' ? 'Needs Edits' : 'Necesita Edición' },
            { key: 'published' as const, label: copy[locale].filterAll === 'All' ? 'Published' : 'Publicado' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`rounded-lg border p-4 text-left transition ${
                filter === key
                  ? 'border-brand-neon/40 bg-brand-neon/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <p className="text-2xl font-black">{counts[key]}</p>
              <p className="mt-0.5 text-xs uppercase tracking-wider text-white/50">{label}</p>
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', 'draft', 'pending_review', 'approved', 'rejected', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                filter === s
                  ? 'bg-brand-neon text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              {s === 'all' ? t.filterAll : STATUS_CONFIG[s].label}
              <span className="ml-1.5 opacity-60">{s === 'all' ? counts.all : counts[s]}</span>
            </button>
          ))}
        </div>

        {/* Article list */}
        {isLoading ? (
          <p className="py-20 text-center text-white/40">{t.loading}</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 py-20 text-center">
            <p className="text-lg text-white/50">{t.empty}</p>
            <p className="mt-2 text-sm text-white/30">{t.emptyHint}</p>
            <Link
              href={withLocale(locale, '/creator/new')}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
            >
              {t.write}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((article) => {
              const statusCfg = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.draft
              return (
                <div
                  key={article._id}
                  className="flex flex-col gap-4 rounded-xl border border-white/10 bg-brand-charcoal p-5 transition hover:border-white/20 sm:flex-row sm:items-center"
                >
                  {/* Thumbnail */}
                  {article.imageUrl ? (
                    <Image
                      src={article.imageUrl}
                      alt={article.title}
                      width={128}
                      height={80}
                      className="h-20 w-32 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl text-white/20">
                      📄
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {article.category && (
                        <span className="text-xs uppercase tracking-wider text-white/30">
                          {article.category}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 truncate font-display text-lg font-bold leading-tight">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-white/50">{article.excerpt}</p>
                    )}
                    <p className="mt-2 text-xs text-white/30">
                      {t.created} {new Date(article._createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 gap-2 sm:flex-col">
                    {article.status !== 'published' && (
                      <Link
                        href={withLocale(locale, `/creator/edit/${article._id}`)}
                        className="rounded-md border border-white/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:border-brand-neon hover:text-brand-neon"
                      >
                        {t.edit}
                      </Link>
                    )}
                    {(article.status === 'draft' || article.status === 'rejected') && (
                      <button
                        onClick={() => handleDelete(article._id)}
                        disabled={deleting === article._id}
                        className="rounded-md border border-red-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400/70 transition hover:border-red-500 hover:text-red-400 disabled:opacity-40"
                      >
                        {deleting === article._id ? '…' : t.delete}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
