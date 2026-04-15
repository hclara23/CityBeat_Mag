'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { ArticleForm } from '../_components/ArticleForm'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/supabase/auth'

export default function NewArticlePage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [authorName, setAuthorName] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }
      const name = user.user_metadata?.full_name || ''
      setAuthorName(name)
      setReady(true)
    })
  }, [router, locale])

  if (!ready) {
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
        mode="new"
        initialValues={{ authorName }}
      />
    </>
  )
}
