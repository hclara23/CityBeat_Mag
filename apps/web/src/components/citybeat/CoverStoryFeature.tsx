import Image from 'next/image'
import Link from 'next/link'
import { coverStory, coverStoryCopy } from '@/lib/cover-story'

export function CoverStoryFeature({ locale }: { locale: string }) {
  const copy = coverStoryCopy(locale)
  const href = `/${locale}${coverStory.path}`
  return (
    <section aria-labelledby="cover-story-heading" className="relative overflow-hidden border-b border-white/10 bg-brand-ink">
      <div className="container-wide grid items-center gap-10 py-10 md:grid-cols-[1.2fr_0.8fr] md:gap-16 md:py-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">CityBeat Magazine · {copy.issue}</p>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-brand-gold">{copy.label} / Premier Clinic</p>
          <h1 id="cover-story-heading" className="mt-4 max-w-2xl text-balance font-display text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">{copy.headline}</h1>
          <p className="mt-6 max-w-xl text-xl leading-8 text-white/80">{copy.summary}</p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">{locale === 'es' ? 'Una historia de raíces locales, atención bilingüe y pacientes que se sienten escuchados.' : 'A story of local roots, bilingual care, and patients who feel heard.'}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href={href} className="inline-flex min-h-[48px] items-center justify-center rounded-md bg-brand-neon px-6 py-3 text-center text-sm font-black text-black transition hover:bg-cyan-300">{copy.read} <span aria-hidden="true" className="ml-2">→</span></Link>
            <Link href={`/${locale}/directory/premier-clinic`} className="inline-flex min-h-[48px] items-center text-sm font-bold text-white/80 underline decoration-white/30 underline-offset-4 hover:text-brand-neon">{copy.listing}</Link>
          </div>
        </div>
        <Link href={href} aria-label={copy.read} className="mx-auto block w-full max-w-[340px] transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">
          <Image src={coverStory.cover} alt={copy.coverAlt} width={1400} height={1771} priority sizes="(max-width: 400px) 90vw, 340px" className="h-auto w-full border border-white/15 shadow-2xl" />
        </Link>
      </div>
    </section>
  )
}
