import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { getAdProducts, getEvents, getTopStories, withLocale, type Locale } from '@/components/citybeat/content'
import { getPublishedArticles } from '@/lib/articles'
import { getUpcomingEvents } from '@/lib/events'
import { CoverStoryFeature } from '@/components/citybeat/CoverStoryFeature'
import { MachelleStoryCard } from '@/components/citybeat/MachelleStoryCard'
import { NewsletterForm } from '@/components/NewsletterForm'
import { AdBanner } from '@/components/citybeat/AdBanner'
import { ArticleVisual } from '@/components/citybeat/ArticleVisual'
import { jsonLdSafe } from '@/lib/jsonld'
import { affiliateTicketUrl } from '@/lib/affiliate'
import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo'
type HomePageProps = {
  params: Promise<{
    locale: string
  }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: HomePageProps): Promise<Metadata> {
  const params = await props.params;
  const isEs = params.locale === 'es'
  const title = isEs
    ? 'CityBeat — Noticias locales, eventos y directorio de negocios de El Paso'
    : 'CityBeat — El Paso Local News, Events & Business Directory'
  const description = isEs
    ? 'Noticias, eventos, ofertas y un directorio de negocios en español e inglés para el Condado de El Paso, Horizon, Socorro, Clint y Las Cruces.'
    : 'Bilingual local news, events, deals, and a business directory for El Paso County, Horizon, Socorro, Clint, and Las Cruces.'
  return {
    title,
    description,
    alternates: localeAlternates(params.locale, '/'),
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: `/api/og?title=${encodeURIComponent(isEs ? 'Noticias locales de El Paso' : 'El Paso Local News & Directory')}&eyebrow=${encodeURIComponent('CityBeat')}` }],
    },
  }
}

export default async function Home(props: HomePageProps) {
  const params = await props.params;
  const locale = (params.locale || 'en') as Locale
  const published = await getPublishedArticles({ limit: 3 })
  const importedStories = published.map((article) => ({
    title: locale === 'es' ? article.titleES : article.title,
    dek: locale === 'es' ? article.excerptES : article.excerpt,
    category: article.category,
    image: article.image,
    href: `/stories/${article.slug}`,
  }))
  const stories = importedStories.length > 0 ? importedStories : getTopStories(locale)
  const secondaryStories = stories.slice(0, 2)
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
  // `copy[locale as 'en' | 'es']` asserted something that was not true: any other
  // locale produced undefined and the next property read threw. The layout now
  // rejects unknown locales, so this is belt-and-braces — but a cast that lies is
  // how this became a 500 in the first place.
  const localeCopy = locale === 'es' ? copy.es : copy.en

  return (
    <CityBeatShell locale={locale}>
      <CoverStoryFeature locale={locale} />

      {/* Sponsored banner (renders only when an active banner exists) */}
      <div className="container-wide mt-10">
        <AdBanner placement="home_top" locale={locale} />
      </div>

      <section className="border-y border-white/10 bg-brand-dark py-16">
        <div className="container-wide grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <MachelleStoryCard locale={locale} />
          {secondaryStories.map((story) => (
            <Link key={story.title} href={withLocale(locale, story.href)} className="group">
              <article className="grid gap-4">
                <ArticleVisual
                  identifier={story.href}
                  title={story.title}
                  category={story.category}
                  image={story.image}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="aspect-[4/3] rounded-md"
                />
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
            <Link href={withLocale(locale, '/events')} className="text-sm font-black uppercase tracking-wider text-brand-neon hover:underline">
              {localeCopy.fullCalendar}
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((event) => (
              <article key={event.title} className="group overflow-hidden glass-panel flex flex-col h-full">
                {/* ArticleVisual guards a null image_url (which crashed next/image
                    here) with a branded fallback card, and matches the story cards. */}
                <ArticleVisual
                  identifier={event.title}
                  title={event.title}
                  category="events"
                  image={event.image}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="aspect-[4/3] w-full"
                />
                <div className="p-6 flex-grow flex flex-col">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold">{event.meta}</p>
                  <h3 className="mt-3 text-2xl font-black text-white flex-grow">{event.title}</h3>
                  {event.ticket_url && (
                    <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md border border-brand-neon/50 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-brand-neon hover:bg-brand-neon hover:text-black transition">
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
      <section className="border-y border-brand-neon/15 bg-brand-neon/[0.035] py-16">
        <div className="container-wide grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{locale === 'es' ? 'Para negocios locales' : 'For local businesses'}</p>
            <h2 className="mt-3 font-display text-4xl font-black uppercase text-white">{locale === 'es' ? 'Reclama gratis. Crece con Premium.' : 'Claim free. Grow with Premium.'}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60">{locale === 'es' ? 'Administra la información esencial sin tarjeta, o desbloquea prospectos completos, contenido enriquecido y un panel que muestra llamadas, clics, indicaciones y solicitudes.' : 'Manage essential information with no card required, or unlock complete leads, richer content, and a dashboard that shows calls, clicks, directions, and requests.'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={withLocale(locale, '/directory')} className="rounded-md border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white">{locale === 'es' ? 'Reclamar gratis' : 'Claim free'}</Link>
            <Link href={withLocale(locale, '/premium')} className="rounded-md bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-wider text-black">{locale === 'es' ? 'Ver Premium' : 'See Premium'}</Link>
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
