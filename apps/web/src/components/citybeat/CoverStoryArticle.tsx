import Image from 'next/image'
import Link from 'next/link'
import { coverStory, coverStoryCopy } from '@/lib/cover-story'
import { ShareButtons } from './ShareButtons'
import { ImageGlare } from './ImageGlare'

export function CoverStoryArticle({ locale }: { locale: string }) {
  const copy = coverStoryCopy(locale)
  const shareProps = { locale: locale === 'es' ? 'es' as const : 'en' as const, url: `https://citybeatmag.co/${locale}${coverStory.path}`, title: coverStory.title }
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
          <ShareButtons {...shareProps} className="mt-6" />
          <aside aria-label={locale === 'es' ? 'Nota del archivo' : 'Archive note'} className="mt-7 rounded-md border border-brand-gold/30 bg-brand-charcoal p-5 text-sm leading-6 text-white/80">
            <p>{copy.archive}</p>
            <Link href={`/${locale}/directory/premier-clinic`} className="mt-2 inline-block font-bold text-brand-neon underline">{copy.listing} →</Link>
          </aside>
          <p className="mt-8 text-xs font-bold uppercase tracking-widest text-white/50">{copy.original}</p>
          <figure className="mt-6 max-w-3xl">
            <ImageGlare><Image {...coverStory.photos.team} alt={locale === 'es' ? 'Retrato de grupo en Premier Primary Care Clinic' : 'Group portrait at Premier Primary Care Clinic'} sizes="(max-width: 1024px) 100vw, 768px" className="h-auto w-full rounded-md" /></ImageGlare>
            <figcaption className="mt-2 text-xs leading-5 text-white/60">{locale === 'es' ? 'Foto proporcionada para este reportaje. El personal retratado puede haber cambiado desde que se tomó la imagen.' : 'Photo supplied for this feature. Staff pictured may have changed since the photograph was taken.'}</figcaption>
          </figure>
          <div lang="en" className="mt-6 max-w-3xl space-y-10">
            {coverStory.sections.map((section, i) => (
              <section key={i}>
                {section.heading && <h2 className="mb-4 text-2xl font-bold text-white">{section.heading}</h2>}
                <div className="space-y-5 text-lg leading-8 text-white/80">
                  {section.paragraphs.map((paragraph, j) => <p key={j}>{paragraph}</p>)}
                </div>
                {i === 4 && <figure lang={locale === 'es' ? 'es' : 'en'} className="mx-auto mt-8 max-w-lg">
                  <ImageGlare><Image {...coverStory.photos.community} alt={locale === 'es' ? 'Grupo detrás de una mesa de Premier Primary Care Clinic en un evento comunitario' : 'Group behind a Premier Primary Care Clinic table at a community event'} sizes="(max-width: 600px) 100vw, 512px" className="h-auto w-full rounded-md" /></ImageGlare>
                  <figcaption className="mt-2 text-xs leading-5 text-white/60">{locale === 'es' ? 'Premier Primary Care en la comunidad. Foto proporcionada para este reportaje.' : 'Premier Primary Care in the community. Photo supplied for this feature.'}</figcaption>
                </figure>}
              </section>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-5 border-t border-white/15 pt-6 text-sm font-bold">
            <Link href={`/${locale}/directory/premier-clinic`} className="text-brand-neon underline">{copy.listing}</Link>
            <a href="https://premierclinic.us/" className="text-brand-neon underline">premierclinic.us</a>
            <a href={coverStory.pdf} className="text-brand-neon underline">{copy.pdf}</a>
          </div>
          <ShareButtons {...shareProps} className="mt-8" />
        </div>
        <figure className="order-first mx-auto w-full max-w-[280px] lg:order-none lg:max-w-none">
          <ImageGlare><Image src={coverStory.cover} alt={copy.coverAlt} width={1400} height={1771} sizes="300px" priority className="h-auto w-full border border-white/15 shadow-xl" /></ImageGlare>
          <figcaption className="mt-3 text-xs leading-5 text-white/60">CityBeat Magazine · {copy.issue}</figcaption>
          <a href={coverStory.pdf} className="mt-4 inline-block text-sm font-bold text-brand-neon underline">{copy.pdf}</a>
        </figure>
      </div>
    </article>
  )
}
