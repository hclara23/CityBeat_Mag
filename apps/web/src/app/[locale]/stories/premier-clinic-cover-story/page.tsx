import type { Metadata } from 'next'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { CoverStoryArticle } from '@/components/citybeat/CoverStoryArticle'
import { coverStory } from '@/lib/cover-story'
import { jsonLdSafe } from '@/lib/jsonld'
import { localeAlternates } from '@/lib/seo'

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  return {
    title: `${coverStory.title} · CityBeat Cover Story`,
    description: coverStory.excerpt,
    authors: [{ name: coverStory.author }],
    alternates: localeAlternates(params.locale, coverStory.path),
    openGraph: { title: coverStory.title, description: coverStory.excerpt, type: 'article', images: [{ url: coverStory.cover, width: 1400, height: 1771 }] },
    twitter: { card: 'summary_large_image', title: coverStory.title, description: coverStory.excerpt, images: [coverStory.cover] },
  }
}

export default async function PremierCoverStoryPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  return <CityBeatShell locale={params.locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe({
      '@context': 'https://schema.org', '@type': 'Article',
      headline: coverStory.title, description: coverStory.excerpt,
      image: `https://citybeatmag.co${coverStory.cover}`,
      inLanguage: 'en', author: { '@type': 'Person', name: coverStory.author },
      publisher: { '@type': 'Organization', name: 'CityBeat Magazine' },
      mainEntityOfPage: `https://citybeatmag.co/${params.locale}${coverStory.path}`,
    }) }} />
    <CoverStoryArticle locale={params.locale} />
  </CityBeatShell>
}
