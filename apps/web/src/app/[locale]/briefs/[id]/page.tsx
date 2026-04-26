'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, Button } from '@citybeat/ui'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { sanityClient } from '@/lib/sanity'
import { getLocalArticleById, getLocalArticlesByCategory } from '@/lib/localArticles'
import { useTranslations } from '@/components/TranslationProvider'

interface Brief {
  _id: string
  slug?: string
  title: string
  content: string
  contentEN: string
  contentES: string
  excerpt?: string
  category: string
  publishedAt: string
  source: string
  image?: string | null
  status: string
}

function getBriefHref(locale: string, brief: Brief) {
  return `/${locale}/briefs/${brief.slug || brief._id}`
}

function getBriefContent(brief: Brief, locale: string) {
  const localized = locale === 'es' ? brief.contentES : brief.contentEN
  return localized || brief.content
}

export default function BriefDetailPage() {
  const params = useParams()
  const locale = params.locale as string
  const id = params.id as string
  const t = useTranslations()

  const [brief, setBrief] = useState<Brief | null>(null)
  const [relatedBriefs, setRelatedBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const localBrief = getLocalArticleById(id)
        if (localBrief) {
          setBrief(localBrief)
          setRelatedBriefs(
            getLocalArticlesByCategory(localBrief.category)
              .filter((article) => article._id !== localBrief._id)
              .slice(0, 3)
          )
          setLoading(false)
          return
        }

        // Fetch from Supabase via API (or directly if allowed)
        const res = await fetch(`/api/creator/articles/${id}`)
        if (res.ok) {
          const data = await res.json()
          setBrief(data.article)
          // Fetch related (simplification for now)
          const relatedRes = await fetch(`/api/briefs?category=${data.article.category}`)
          if (relatedRes.ok) {
            const relatedData = await relatedRes.json()
            setRelatedBriefs(relatedData.data.filter((b: any) => b.id !== id).slice(0, 3))
          }
        } else {
          setError('Brief not found')
        }
      } catch (error) {
        console.error('Failed to fetch brief:', error)
        setError('Failed to load brief')
      } finally {
        setLoading(false)
      }
    }

    fetchBrief()
  }, [id])

  const contentParagraphs = brief
    ? (typeof brief.content === 'string'
        ? getBriefContent(brief, locale).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : (brief.content as any).content?.filter((b: any) => b.type === 'paragraph').map((b: any) => b.content?.map((c: any) => c.text).join('') || '').filter(Boolean) || [])
    : []

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">{error || t('common.error')}</p>
            <Button asChild variant="primary">
              <Link href={`/${locale}/briefs`}>
                {t('briefs.title')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <SiteHeader />

      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href={`/${locale}/briefs`}
            className="text-primary hover:text-primary/80 font-medium flex items-center gap-2"
          >
            Back to {t('briefs.title')}
          </Link>
        </div>

        {/* Header */}
        <header className="mb-8 border-b border-gray-200 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">
              {brief.category}
            </span>
            <span className="text-xs text-gray-500">{brief.source}</span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {brief.title}
          </h1>

          <p className="text-gray-600">
            {t('briefs.published')} {new Date(brief.publishedAt).toLocaleDateString(
              locale === 'es' ? 'es-MX' : 'en-US',
              { year: 'numeric', month: 'long', day: 'numeric' }
            )}
          </p>
        </header>

        {brief.image ? (
          <div className="mb-10 overflow-hidden rounded-md bg-gray-100">
            <Image
              src={brief.image}
              alt=""
              width={1200}
              height={760}
              priority
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        ) : null}

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-12 space-y-6">
          {contentParagraphs.map((paragraph, index) => (
            <p key={index} className="text-lg text-gray-700 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Source Info */}
        <div className="bg-gray-50 p-6 rounded-lg mb-12 border border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{t('briefs.source')}:</span> {brief.source}
          </p>
        </div>

        {/* Related Briefs */}
        {relatedBriefs.length > 0 && (
          <section className="mt-16 pt-12 border-t border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              {t('briefs.relatedStories') || 'Related Stories'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedBriefs.map(relatedBrief => (
                <Link key={relatedBrief._id} href={getBriefHref(locale, relatedBrief)}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full overflow-hidden">
                    {relatedBrief.image ? (
                      <Image
                        src={relatedBrief.image}
                        alt=""
                        width={600}
                        height={400}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : null}
                    <div className="h-full flex flex-col">
                      <div className="flex-1 p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-primary uppercase">
                            {relatedBrief.category}
                          </span>
                          <span className="text-xs text-gray-500">{relatedBrief.source}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-3 hover:text-primary transition-colors">
                          {relatedBrief.title}
                        </h3>
                        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                          {relatedBrief.excerpt || getBriefContent(relatedBrief, locale)}
                        </p>
                      </div>
                      <div className="p-6 pt-0">
                        <p className="text-xs text-gray-500">
                          {new Date(relatedBrief.publishedAt).toLocaleDateString(
                            locale === 'es' ? 'es-MX' : 'en-US'
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
