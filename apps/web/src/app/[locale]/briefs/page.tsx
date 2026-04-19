'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, Button } from '@citybeat/ui'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { sanityClient } from '@/lib/sanity'
import { localArticles } from '@/lib/localArticles'
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

const categoryIds = ['news', 'business', 'events', 'culture']

function getBriefHref(locale: string, brief: Brief) {
  return `/${locale}/briefs/${brief.slug || brief._id}`
}

function getBriefContent(brief: Brief, locale: string) {
  const localized = locale === 'es' ? brief.contentES : brief.contentEN
  return localized || brief.content
}

export default function BriefsPage() {
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations()

  const [briefs, setBriefs] = useState<Brief[]>(localArticles)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    const initialCategory = new URLSearchParams(window.location.search).get('category')
    setSelectedCategory(initialCategory && categoryIds.includes(initialCategory) ? initialCategory : null)
  }, [])

  useEffect(() => {
    const fetchBriefs = async () => {
      try {
        const query = `*[_type == "brief" && status == "published"] | order(publishedAt desc) [0...50] {
          _id,
          "slug": slug.current,
          title,
          content,
          contentEN,
          contentES,
          category,
          publishedAt,
          source,
          status
        }`

        const data = await sanityClient.fetch<Brief[]>(query)
        const remoteBriefs = Array.isArray(data) ? data : []
        const localIds = new Set(localArticles.map((article) => article._id))
        setBriefs([
          ...localArticles,
          ...remoteBriefs.filter((brief) => !localIds.has(brief._id)),
        ])
      } catch (error) {
        console.error('Failed to fetch briefs:', error)
        setBriefs(localArticles)
      } finally {
        setLoading(false)
      }
    }

    fetchBriefs()
  }, [])

  const categories = [
    { id: 'all', label: t('categories.all') },
    { id: 'news', label: t('categories.news') },
    { id: 'business', label: t('categories.business') },
    { id: 'events', label: t('categories.events') },
    { id: 'culture', label: t('categories.culture') },
  ]

  const filteredBriefs = selectedCategory && selectedCategory !== 'all'
    ? briefs.filter(b => b.category === selectedCategory)
    : briefs

  const handleCategorySelect = (category: string) => {
    const nextCategory = category === 'all' ? null : category
    setSelectedCategory(nextCategory)

    const url = new URL(window.location.href)
    if (nextCategory) {
      url.searchParams.set('category', nextCategory)
    } else {
      url.searchParams.delete('category')
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('briefs.title')}
          </h1>
          <p className="text-xl text-gray-600">
            {t('briefs.description')}
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-12 justify-center">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                (selectedCategory === null && cat.id === 'all') ||
                selectedCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Briefs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : filteredBriefs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">{t('briefs.noBriefs')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBriefs.map(brief => (
              <Link
                key={brief._id}
                href={getBriefHref(locale, brief)}
                className="block hover:shadow-lg transition-shadow"
              >
                <Card className="h-full overflow-hidden hover:border-primary/50">
                  {brief.image ? (
                    <div className="bg-gray-100">
                      <Image
                        src={brief.image}
                        alt=""
                        width={900}
                        height={600}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="h-full flex flex-col">
                    <div className="flex-1 p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-primary uppercase">
                          {brief.category}
                        </span>
                        <span className="text-xs text-gray-500">{brief.source}</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-3 hover:text-primary transition-colors">
                        {brief.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                        {brief.excerpt || getBriefContent(brief, locale)}
                      </p>
                    </div>
                    <div className="space-y-2 p-6 pt-0">
                      <p className="text-xs text-gray-500">
                        {new Date(brief.publishedAt).toLocaleDateString(
                          locale === 'es' ? 'es-MX' : 'en-US'
                        )}
                      </p>
                      <Button className="w-full" variant="primary" size="sm" asChild>
                        <span>{t('briefs.readMore')}</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
