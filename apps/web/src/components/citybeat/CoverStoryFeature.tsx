import Image from 'next/image'
import Link from 'next/link'
import { coverStory, coverStoryCopy } from '@/lib/cover-story'

const editorialSections = [
  { href: '/stories?category=food', image: '/articles-media/gluten-free-toasted-pecan-and-coconut-caramel-brownies.webp', en: 'Food & Drink', es: 'Comida' },
  { href: '/stories?category=culture', image: '/articles-media/rey-de-la-luna-el-pasos-cosmic-barrio-takes-the-stage.webp', en: 'Arts & Culture', es: 'Arte y cultura' },
  { href: '/directory', image: '/print/premier-community.webp', en: 'Local Business', es: 'Negocios locales' },
  { href: '/events', image: '/print/machelle-wood-speaking.webp', en: 'Things To Do', es: 'Qué hacer' },
] as const

export function CoverStoryFeature({ locale }: { locale: string }) {
  const copy = coverStoryCopy(locale)
  const href = `/${locale}${coverStory.path}`
  return (
    <section aria-labelledby="cover-story-heading" className="border-b border-white/10 bg-[#080d13]">
      <div className="container-wide py-4 sm:py-6 lg:py-8">
        <div className="relative min-h-[520px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,.42)] sm:min-h-[600px]">
          <Image
            src="/print/premier-team.webp"
            alt={copy.coverAlt}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover object-[58%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,9,16,.98)_0%,rgba(4,9,16,.88)_34%,rgba(4,9,16,.2)_72%,rgba(4,9,16,.08)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080d13] to-transparent" />
          <div className="relative z-10 flex min-h-[520px] max-w-2xl flex-col justify-end p-6 sm:min-h-[600px] sm:p-10 lg:p-14">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-neon">CityBeat Magazine · {copy.issue}</p>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-brand-gold">{copy.label} / Premier Clinic</p>
            <h1 id="cover-story-heading" className="mt-3 text-balance font-display text-5xl font-black uppercase leading-[0.92] tracking-[-0.04em] text-white sm:text-7xl lg:text-8xl">{copy.headline}</h1>
            <p className="mt-5 max-w-xl text-lg font-semibold leading-7 text-white/88 sm:text-xl">{copy.summary}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={href} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-neon px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">{copy.read} <span aria-hidden="true" className="ml-2">→</span></Link>
              <Link href={`/${locale}/directory/premier-clinic`} className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 bg-black/25 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:border-brand-neon hover:text-brand-neon">{copy.listing}</Link>
            </div>
          </div>
        </div>

        <nav aria-label={locale === 'es' ? 'Explorar secciones' : 'Explore sections'} className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {editorialSections.map((section) => (
            <Link key={section.href} href={`/${locale}${section.href}`} className="group relative min-h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-brand-charcoal">
              <Image src={section.image} alt="" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-90" />
              <span className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
              <span className="absolute inset-x-4 bottom-4 text-sm font-black uppercase tracking-[0.12em] text-white">{locale === 'es' ? section.es : section.en}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}
