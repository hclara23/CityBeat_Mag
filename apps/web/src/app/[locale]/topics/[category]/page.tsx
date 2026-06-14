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
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'

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

export default function TopicHubPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'en'
  const category = (params.category as string) || ''
  const t = useTranslations()

  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBriefs = async () => {
      try {
        const query = `*[_type == "brief" && status == "published" && category == $category] | order(publishedAt desc) [0...50] {
          _id,
          "slug": slug.current,
          title,
          content,
          contentEN,
          contentES,
          category,
          publishedAt,
          source,
          status,
          image
        }`

        const data = await sanityClient.fetch<Brief[]>(query, { category })
        const remoteBriefs = Array.isArray(data) ? data : []
        const localMatches = localArticles.filter(a => a.category === category)
        const localIds = new Set(localMatches.map((article) => article._id))
        setBriefs([
          ...localMatches,
          ...remoteBriefs.filter((brief) => !localIds.has(brief._id)),
        ])
      } catch (error) {
        console.error('Failed to fetch briefs for category:', error)
        setBriefs(localArticles.filter(a => a.category === category))
      } finally {
        setLoading(false)
      }
    }

    if (category) {
      fetchBriefs()
    }
  }, [category])

  const formatCategory = (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1)

  return (
    <CityBeatShell locale={locale as 'en' | 'es'}>
      <div className="min-h-screen bg-black/90 text-white pt-24 pb-12">
        <div className="container-wide">
          <div className="mb-12">
            <h1 className="text-4xl font-black md:text-6xl text-brand-neon capitalize">
              {formatCategory(category)} News
            </h1>
            <p className="text-xl text-white/70 mt-4">
              The latest {category} updates from CityBeat Mag.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-brand-neon border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : briefs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60 text-lg">No articles found in this topic.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {briefs.map(brief => (
                <Link
                  key={brief._id}
                  href={getBriefHref(locale, brief)}
                  className="block group"
                >
                  <Card className="h-full overflow-hidden bg-black/40 border border-white/10 group-hover:border-brand-neon/50 transition">
                    {brief.image ? (
                      <div className="bg-black/20">
                        <Image
                          src={brief.image}
                          alt=""
                          width={900}
                          height={600}
                          className="aspect-[4/3] w-full object-cover opacity-80 group-hover:scale-105 transition duration-500"
                        />
                      </div>
                    ) : null}
                    <div className="h-full flex flex-col">
                      <div className="flex-1 p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-brand-neon uppercase">
                            {brief.category}
                          </span>
                          <span className="text-xs text-white/50">{brief.source}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 line-clamp-3 group-hover:text-brand-neon transition-colors">
                          {brief.title}
                        </h3>
                        <p className="text-white/60 text-sm line-clamp-3 mb-4">
                          {brief.excerpt || getBriefContent(brief, locale)}
                        </p>
                      </div>
                      <div className="p-6 pt-0">
                        <p className="text-xs text-white/40">
                          {new Date(brief.publishedAt).toLocaleDateString(
                            locale === 'es' ? 'es-MX' : 'en-US'
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* JSON-LD for Topic Cluster */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${formatCategory(category)} News - CityBeat Mag`,
            description: `The latest ${category} updates, events, and news from CityBeat Mag.`,
            url: `https://citybeatmag.co/${locale}/topics/${category}`,
            hasPart: briefs.map(brief => ({
              '@type': 'NewsArticle',
              headline: brief.title,
              url: `https://citybeatmag.co/${locale}/briefs/${brief.slug || brief._id}`,
              datePublished: brief.publishedAt
            }))
          })
        }}
      />
    </CityBeatShell>
  )
}
