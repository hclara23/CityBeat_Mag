import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { getAdProducts, getEvents, getTopStories, withLocale, type Locale } from '@/components/citybeat/content'
import { getPublishedArticles } from '@/lib/articles'
import { getUpcomingEvents } from '@/lib/events'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { NewsletterForm } from '@/components/NewsletterForm'
import { AdBanner } from '@/components/citybeat/AdBanner'
import { jsonLdSafe } from '@/lib/jsonld'
import { affiliateTicketUrl } from '@/lib/affiliate'
type HomePageProps = {
  params: {
    locale: string
  }
}

export const dynamic = 'force-dynamic'

export default async function Home({ params }: HomePageProps) {
  const locale = (params.locale || 'en') as Locale
  const published = await getPublishedArticles({ limit: 3 })
  const importedStories = published.map((article) => ({
    title: locale === 'es' ? article.titleES : article.title,
    dek: locale === 'es' ? article.excerptES : article.excerpt,
    category: article.category,
    image: article.image ?? 'https://picsum.photos/seed/citybeat-local/1600/1000',
    href: `/stories/${article.slug}`,
  }))
  const stories = importedStories.length > 0 ? importedStories : getTopStories(locale)
  const featured = stories[0]
  const secondaryStories = stories.slice(1)
  const adProducts = getAdProducts(locale)

  // Upcoming, publicly-visible events (excludes pending submissions + past events).
  const dbEvents = (await getUpcomingEvents(3)) as any[]
  
  const staticEvents = getEvents(locale)
  const events = dbEvents && dbEvents.length > 0 
    ? dbEvents.map(e => ({
        title: locale === 'en' ? e.title_en : e.title_es,
        meta: locale === 'en' ? e.meta_en : e.meta_es,
        image: e.image_url,
        ticket_url: affiliateTicketUrl(e.ticket_url)
      }))
    : staticEvents.map(e => ({
        title: e.title,
        meta: e.meta,
        image: e.image,
        ticket_url: null
      }))


  const copy = {
    en: {
      regionTag: 'El Paso / Las Cruces / Borderlands',
      headline: 'CityBeat Magazine',
      subhead: 'Bilingual local culture, business, food, events, and civic life for the cities that keep the borderlands moving.',
      readLatest: 'Read The Latest',
      advertise: 'Advertise',
      weeklyEdit: 'Weekly Edit',
      weeklyHeading: 'Do not miss the beat.',
      weeklyCopy: 'Get local picks, stories, events, and advertiser opportunities in one clean Friday send.',
      emailPlaceholder: 'Email address',
      join: 'Join',
      happeningNow: 'Happening Now',
      eventsHeading: 'Events & Culture',
      fullCalendar: 'Full Calendar',
      localCommerce: 'Local Commerce',
      directoryHeading: 'A magazine built for the businesses locals actually visit.',
    },
    es: {
      regionTag: 'El Paso / Las Cruces / Frontera',
      headline: 'Revista CityBeat',
      subhead: 'Cultura local bilingüe, negocios, comida, eventos y vida cívica para las ciudades que mantienen la frontera en movimiento.',
      readLatest: 'Leer Lo Último',
      advertise: 'Anunciar',
      weeklyEdit: 'Selección Semanal',
      weeklyHeading: 'No te pierdas el ritmo.',
      weeklyCopy: 'Recibe selecciones locales, historias, eventos y oportunidades publicitarias en un solo envío del viernes.',
      emailPlaceholder: 'Dirección de correo',
      join: 'Unirse',
      happeningNow: 'En Marcha',
      eventsHeading: 'Eventos y Cultura',
      fullCalendar: 'Calendario Completo',
      localCommerce: 'Comercio Local',
      directoryHeading: 'Una revista construida para los negocios que los locales realmente visitan.',
    },
  }
  const localeCopy = copy[locale as 'en' | 'es']

  return (
    <CityBeatShell locale={locale}>
      <section className="relative min-h-[86svh] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={featured.image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/72 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent" />
        </div>

        <div className="container-wide relative z-10 flex min-h-[86svh] items-end pb-16 pt-28">
          <div className="max-w-4xl">
            <p className="mb-5 inline-flex rounded-md border border-brand-neon/30 bg-black/35 px-3 py-2 text-xs font-black uppercase tracking-[0.3em] text-brand-neon">
              {localeCopy.regionTag}
            </p>
            <h1 className="text-balance font-display text-5xl font-black leading-[0.88] tracking-tight text-white sm:text-7xl lg:text-8xl">
              {localeCopy.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 md:text-xl">
              {localeCopy.subhead}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={withLocale(locale, featured?.href || '/')} className="rounded-md bg-brand-neon px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
                {localeCopy.readLatest}
              </Link>
              <Link href={withLocale(locale, '/ads')} className="rounded-md border border-white/20 px-6 py-3 text-center text-sm font-black uppercase tracking-wider text-white transition hover:bg-white/10">
                {localeCopy.advertise}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsored banner (renders only when an active banner exists) */}
      <div className="container-wide mt-10">
        <AdBanner placement="home_top" locale={locale} />
      </div>

      <section className="border-y border-white/10 bg-brand-dark py-16">
        <div className="container-wide grid gap-8 md:grid-cols-3">
          {secondaryStories.map((story) => (
            <Link key={story.title} href={withLocale(locale, story.href)} className="group">
              <article className="grid gap-4">
                <div className="overflow-hidden rounded-md bg-white/5">
                  <Image
                    src={story.image}
                    alt=""
                    width={900}
                    height={650}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="aspect-[4/3] w-full object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
                  />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{story.category}</p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-white transition group-hover:text-brand-neon">
                    {story.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/55">{story.dek}</p>
                </div>
              </article>
            </Link>
          ))}
          <div className="glass-panel p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-magenta">{localeCopy.weeklyEdit}</p>
            <h2 className="mt-3 text-3xl font-black text-white">{localeCopy.weeklyHeading}</h2>
            <p className="mt-4 text-sm leading-6 text-white/60">
              {localeCopy.weeklyCopy}
            </p>
            <NewsletterForm 
              locale={locale} 
              emailPlaceholder={localeCopy.emailPlaceholder} 
              joinText={localeCopy.join} 
            />
          </div>
        </div>
      </section>

      <section id="events" className="bg-brand-charcoal/70 py-20">
        <div className="container-wide">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">{localeCopy.happeningNow}</p>
              <h2 className="mt-3 text-4xl font-black text-white md:text-5xl">{localeCopy.eventsHeading}</h2>
            </div>
            <Link href={withLocale(locale, '/#events')} className="text-sm font-black uppercase tracking-wider text-brand-neon hover:underline">
              {localeCopy.fullCalendar}
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((event) => (
              <article key={event.title} className="group overflow-hidden glass-panel flex flex-col h-full">
                <Image src={event.image} alt="" width={760} height={520} sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[4/3] w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
                <div className="p-6 flex-grow flex flex-col">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold">{event.meta}</p>
                  <h3 className="mt-3 text-2xl font-black text-white flex-grow">{event.title}</h3>
                  {event.ticket_url && (
                    <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-md border border-brand-neon/50 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-brand-neon hover:bg-brand-neon hover:text-black transition">
                      {locale === 'es' ? 'Comprar Boletos' : 'Get Tickets'}
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="directory" className="citybeat-grid py-20">
        <div className="container-wide grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">{localeCopy.localCommerce}</p>
            <h2 className="mt-3 text-4xl font-black leading-none text-white md:text-6xl">{localeCopy.directoryHeading}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(adProducts).map(([key, product]) => (
              <Link key={key} href={withLocale(locale, `/ads/${key}`)} className="citybeat-panel group rounded-md p-6 transition hover:-translate-y-1 hover:border-brand-neon/40">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">{product.shortTitle}</p>
                <p className="mt-5 text-4xl font-black text-white">{product.price}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/65">{product.cadence}</p>
                <p className="mt-5 text-sm leading-6 text-white/58">{product.dek}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSafe(
            events.map((event) => ({
              '@context': 'https://schema.org',
              '@type': 'Event',
              name: event.title,
              description: event.meta,
              image: event.image,
              url: event.ticket_url || `https://citybeatmag.co/${locale}`,
            }))
          ),
        }}
      />
    </CityBeatShell>
  )
}
