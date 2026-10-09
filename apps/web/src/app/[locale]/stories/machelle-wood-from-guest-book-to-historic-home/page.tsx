import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { ShareButtons } from '@/components/citybeat/ShareButtons'
import { ImageGlare } from '@/components/citybeat/ImageGlare'
import story from '@/lib/machelle-story.json'
import { jsonLdSafe } from '@/lib/jsonld'
import { localeAlternates } from '@/lib/seo'

const path = `/stories/${story.slug}`
const photo = '/print/machelle-wood-speaking.webp'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return {
    title: `${story.title} · Machelle Wood · CityBeat`, description: story.excerpt,
    ...(story.author ? { authors: [{ name: story.author }] } : {}),
    alternates: localeAlternates(params.locale, path),
    openGraph: { title: story.title, description: story.excerpt, type: 'article', images: [{ url: photo, width: 1200, height: 1600 }] },
    twitter: { card: 'summary_large_image', title: story.title, description: story.excerpt, images: [photo] },
  }
}

export default function MachelleStoryPage({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  const url = `https://citybeatmag.co/${locale}${path}`
  const share = { locale, url, title: story.title } as const
  return <CityBeatShell locale={locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe({
      '@context': 'https://schema.org', '@type': 'Article', headline: story.title,
      description: story.excerpt, image: `https://citybeatmag.co${photo}`, inLanguage: 'en',
      ...(story.author ? { author: { '@type': 'Person', name: story.author } } : {}),
      publisher: { '@type': 'Organization', name: 'CityBeat Magazine' }, mainEntityOfPage: url,
    }) }} />
    <article className="container-wide py-10 md:py-16">
      <Link href={`/${locale}/stories`} className="text-sm font-bold text-brand-neon hover:underline">← {locale === 'es' ? 'Historias' : 'Stories'}</Link>
      <header className="mt-8 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">{locale === 'es' ? 'Edición Octubre–Noviembre · Perfil' : 'October–November issue · Profile'}</p>
        <h1 lang="en" className="mt-4 text-balance font-display text-4xl font-black leading-tight text-white md:text-5xl">{story.title}</h1>
        <p lang="en" className="mt-5 text-xl leading-8 text-white/75">{story.excerpt}</p>
        {story.author && <p className="mt-5 text-sm text-white/60">{locale === 'es' ? 'Por' : 'By'} {story.author} · CityBeat Magazine</p>}
        <ShareButtons {...share} className="mt-6" />
        {locale === 'es' && <p className="mt-5 text-sm text-white/60">Artículo original en inglés.</p>}
      </header>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
        <div lang="en" className="min-w-0 max-w-3xl space-y-10">
          {story.sections.map((section, i) => <section key={i}>
            {section.heading && <h2 className="mb-4 text-2xl font-bold text-white">{section.heading}</h2>}
            <div className="space-y-5 text-lg leading-8 text-white/80">{section.paragraphs.map((paragraph, j) => <p key={j}>{paragraph}</p>)}</div>
            {i === 2 && <figure className="mx-auto mt-8 max-w-[423px]">
              <ImageGlare tilt><Image src="/print/machelle-wood-archives.webp" alt="Machelle Wood examining an open archival volume" width={423} height={564} sizes="(max-width: 480px) 100vw, 423px" className="h-auto w-full rounded-md" /></ImageGlare>
              <figcaption className="mt-2 text-xs leading-5 text-white/60">Machelle Wood with archival materials. Photo supplied for this profile.</figcaption>
            </figure>}
          </section>)}
          <ShareButtons {...share} className="border-t border-white/15 pt-8" />
        </div>
        <figure className="order-first mx-auto w-full max-w-[360px] lg:order-none">
          <ImageGlare tilt><Image src={photo} alt="Machelle Wood speaking beside a projected historical document" width={1200} height={1600} sizes="360px" priority className="h-auto w-full rounded-md" /></ImageGlare>
          <figcaption className="mt-2 text-xs leading-5 text-white/60">{locale === 'es' ? 'Machelle Wood durante una presentación. Foto proporcionada para este perfil.' : 'Machelle Wood during a presentation. Photo supplied for this profile.'}</figcaption>
        </figure>
      </div>
    </article>
  </CityBeatShell>
}
