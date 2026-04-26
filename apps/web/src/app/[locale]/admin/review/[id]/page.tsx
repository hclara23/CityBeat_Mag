'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/supabase/auth'

interface Article {
  id: string
  title: string
  content: any
  excerpt: string
  status: string
  image_url: string
  author: {
    email: string
    full_name: string
  }
}

export default function ReviewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const { id } = use(params)
  
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/articles/${id}`)
      .then(res => res.json())
      .then(data => {
        setArticle(data.article)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [id])

  const handleAction = async (status: 'published' | 'rejected') => {
    setIsBusy(true)
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        router.push(withLocale(locale, '/admin'))
      }
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center">Loading...</div>
  if (!article) return <div className="min-h-screen bg-brand-dark flex items-center justify-center">Not found</div>

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link href={withLocale(locale, '/admin')} className="text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white transition">
            ← Back to Queue
          </Link>
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('rejected')}
              disabled={isBusy}
              className="rounded-md border border-red-500/30 px-6 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition"
            >
              Reject
            </button>
            <button
              onClick={() => handleAction('published')}
              disabled={isBusy}
              className="rounded-md bg-brand-neon px-6 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-cyan-300 transition"
            >
              Approve & Publish
            </button>
          </div>
        </div>

        <article className="prose prose-invert max-w-none">
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon bg-brand-neon/10 px-2 py-1 rounded">
                {article.status}
              </span>
              <span className="text-xs text-white/40">Author: {article.author?.full_name || article.author?.email}</span>
            </div>
            <h1 className="text-5xl font-black mb-6">{article.title}</h1>
            <p className="text-xl text-white/60 font-medium italic">{article.excerpt}</p>
          </header>

          {article.image_url && (
            <div className="my-10 aspect-video rounded-xl overflow-hidden border border-white/10">
              <img src={article.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="text-lg leading-relaxed text-white/80">
            {/* Simple rendering for now, could use a Tiptap viewer later */}
            {typeof article.content === 'string' ? article.content : JSON.stringify(article.content, null, 2)}
          </div>
        </article>
      </main>
    </div>
  )
}
