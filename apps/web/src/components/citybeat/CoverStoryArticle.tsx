import Image from 'next/image'
import Link from 'next/link'
import { coverStory, coverStoryCopy } from '@/lib/cover-story'

export function CoverStoryArticle({ locale }: { locale: string }) {
  const copy = coverStoryCopy(locale)
  return (
    <article className="container-wide py-10 md:py-16">
      <Link href={`/${locale}`} className="text-sm font-bold text-brand-neon hover:underline">← {locale === 'es' ? 'Inicio' : 'Home'}</Link>
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold">{copy.issue} · {copy.label}</p>
          <header lang="en">
            <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-black leading-tight text-white md:text-5xl">{coverStory.title}</h1>
            <p className="mt-5 max-w-3xl text-xl leading-8 text-white/75">{coverStory.excerpt}</p>
            <p className="mt-5 text-sm text-white/60">By {coverStory.author} · CityBeat Magazine</p>
          </header>
          <aside aria-label={locale === 'es' ? 'Nota del archivo' : 'Archive note'} className="mt-7 rounded-md border border-brand-gold/30 bg-brand-charcoal p-5 text-sm leading-6 text-white/80">
            <p>{copy.archive}</p>
            <Link href={`/${locale}/directory/premier-clinic`} className="mt-2 inline-block font-bold text-brand-neon underline">{copy.listing} →</Link>
          </aside>
          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-white/50">{copy.original}</p>
          <div lang="en" className="mt-6 max-w-3xl space-y-10">
            {coverStory.sections.map((section, i) => (
              <section key={i}>
                {section.heading && <h2 className="mb-4 text-2xl font-bold text-white">{section.heading}</h2>}
                <div className="space-y-5 text-lg leading-8 text-white/80">
                  {section.paragraphs.map((paragraph, j) => <p key={j}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-5 border-t border-white/15 pt-6 text-sm font-bold">
            <Link href={`/${locale}/directory/premier-clinic`} className="text-brand-neon underline">{copy.listing}</Link>
            <a href="https://premierclinic.us/" className="text-brand-neon underline">premierclinic.us</a>
            <a href={coverStory.pdf} className="text-brand-neon underline">{copy.pdf}</a>
          </div>
        </div>
        <figure className="order-first mx-auto w-full max-w-[280px] lg:order-none lg:max-w-none">
          <Image src={coverStory.cover} alt={copy.coverAlt} width={1400} height={1771} sizes="300px" priority className="h-auto w-full border border-white/15 shadow-xl" />
          <figcaption className="mt-3 text-xs leading-5 text-white/60">CityBeat Magazine · {copy.issue}</figcaption>
          <a href={coverStory.pdf} className="mt-4 inline-block text-sm font-bold text-brand-neon underline">{copy.pdf}</a>
        </figure>
      </div>
    </article>
  )
}
