import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale, type Locale } from '@/components/citybeat/content'
import { getArticleBySlug } from '@/lib/articles'
import { jsonLdSafe } from '@/lib/jsonld'
import { ShareButtons } from '@/components/citybeat/ShareButtons'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Props = {
  params: { locale: string; slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug)
  if (!article) return { title: 'Story not found · CityBeat' }
  const isEs = params.locale === 'es'
  const url = `${BASE}/${params.locale}/stories/${article.slug}`
  const headline = isEs ? article.titleES : article.title
  const title = `${headline} · CityBeat`
  const description = (isEs ? article.excerptES : article.excerpt)?.slice(0, 200)
  // Prefer the article image; else a branded generated card with the headline.
  const ogImage = article.image || `/api/og?title=${encodeURIComponent(headline)}&eyebrow=${encodeURIComponent(article.category || 'Story')}`
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { en: `${BASE}/en/stories/${article.slug}`, es: `${BASE}/es/stories/${article.slug}` },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: [{ url: ogImage }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function StoryPage({ params }: Props) {
  const locale = (params.locale || 'en') as Locale
  const article = await getArticleBySlug(params.slug)

  if (!article) {
    notFound()
  }

  const isEs = locale === 'es'
  const displayTitle = isEs ? article.titleES : article.title

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: displayTitle,
    description: isEs ? article.excerptES : article.excerpt,
    image: article.image ? [article.image] : undefined,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: article.author },
    publisher: { '@type': 'Organization', name: 'CityBeat Magazine' },
    inLanguage: locale,
    articleSection: article.category,
    mainEntityOfPage: `${BASE}/${locale}/stories/${article.slug}`,
  }

  const body = (locale === 'es' ? article.contentES : article.contentEN) || ''
  const paragraphs = body
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
  const published = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <CityBeatShell locale={locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }} />
      <article className="container-wide max-w-3xl py-16">
        <Link
          href={withLocale(locale, '/stories')}
          className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline"
        >
          {locale === 'es' ? '← Boletines' : '← Stories'}
        </Link>

        <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{article.category}</p>
        <h1 className="mt-3 font-display text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
          {displayTitle}
        </h1>
        <p className="mt-4 text-sm text-white/55">
          {article.author}
          {published ? ` · ${published}` : ''}
        </p>

        <ShareButtons
          url={`${BASE}/${locale}/stories/${article.slug}`}
          title={displayTitle}
          locale={locale}
          className="mt-6"
        />

        {article.image && (
          <div className="mt-8 overflow-hidden rounded-md bg-white/5">
            <Image
              src={article.image}
              alt=""
              width={1200}
              height={800}
              sizes="(max-width: 768px) 100vw, 768px"
              className="aspect-[3/2] w-full object-cover"
            />
          </div>
        )}

        <div className="mt-10 space-y-5 text-lg leading-8 text-white/80">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </CityBeatShell>
  )
}
