'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, Button, Navigation } from '@citybeat/ui'
import { sanityClient } from '@/lib/sanity'
import { useTranslations } from '@/components/TranslationProvider'

interface Brief {
  _id: string
  title: string
  content: string
  contentEN: string
  contentES: string
  category: string
  publishedAt: string
  source: string
  status: string
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
        // Fetch the specific brief
        const query = `*[_type == "brief" && _id == "${id}" && status == "published"] {
          _id,
          title,
          content,
          contentEN,
          contentES,
          category,
          publishedAt,
          source,
          status
        }[0]`

        const data = await sanityClient.fetch(query)

        if (!data) {
          setError('Brief not found')
          setLoading(false)
          return
        }

        setBrief(data)

        // Fetch related briefs from the same category
        const relatedQuery = `*[_type == "brief" && category == "${data.category}" && _id != "${id}" && status == "published"] | order(publishedAt desc) [0...3] {
          _id,
          title,
          content,
          contentEN,
          contentES,
          category,
          publishedAt,
          source,
          status
        }`

        const relatedData = await sanityClient.fetch(relatedQuery)
        setRelatedBriefs(relatedData)
      } catch (error) {
        console.error('Failed to fetch brief:', error)
        setError('Failed to load brief')
      } finally {
        setLoading(false)
      }
    }

    fetchBrief()
  }, [id])

  const displayContent = locale === 'es' ? 'contentES' : 'contentEN'

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
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
        <Navigation />
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
    <div className="min-h-screen bg-white">
      <Navigation />

      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href={`/${locale}/briefs`}
            className="text-primary hover:text-primary/80 font-medium flex items-center gap-2"
          >
            ← {t('briefs.title')}
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

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-12">
          <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
            {brief[displayContent as keyof Brief] || brief.content}
          </p>
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
                <Link key={relatedBrief._id} href={`/${locale}/briefs/${relatedBrief._id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="h-full flex flex-col">
                      <div className="flex-1">
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
                          {relatedBrief[displayContent as keyof Brief] || relatedBrief.content}
                        </p>
                      </div>
                      <div>
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
