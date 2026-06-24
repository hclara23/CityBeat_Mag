'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { ArticleForm, ArticleFormValues } from '../../_components/ArticleForm'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

export default function EditArticlePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const locale = useLocale() as 'en' | 'es'

  const [initial, setInitial] = useState<Partial<ArticleFormValues> | null>(null)
  const [currentStatus, setCurrentStatus] = useState<string>('draft')
  const [error, setError] = useState('')

  useEffect(() => {
    getUser().then(async ({ user, error: authErr }) => {
      if (authErr || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }

      try {
        const res = await fetch(`/api/creator/articles/${id}`)
        if (!res.ok) {
          const data = await res.json()
          if (res.status === 404) {
            router.push(withLocale(locale, '/creator'))
            return
          }
          throw new Error(data.error || 'Failed to load article')
        }
        const { article } = await res.json()

        setCurrentStatus(article.status ?? 'draft')
        setInitial({
          title: article.title ?? '',
          authorName: article.authorName ?? (user.user_metadata?.full_name ?? ''),
          excerpt: article.excerpt ?? '',
          bodyText: article.bodyText ?? '',
          content: article.content ?? null,
          category: article.category ?? '',
          tags: (article.tags ?? []).join(', '),
          assetId: article.imageUrl ?? '',
          imagePreviewUrl: article.imageUrl ?? '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load article')
      }
    })
  }, [id, router, locale])

  if (error) {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <div className="flex items-center justify-center py-32">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <div className="flex items-center justify-center py-32">
          <p className="text-white/40">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SiteHeader />
      <ArticleForm
        locale={locale}
        mode="edit"
        articleId={id}
        initialValues={initial}
        currentStatus={currentStatus}
      />
    </>
  )
}
