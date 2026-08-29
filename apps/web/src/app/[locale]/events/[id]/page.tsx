import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { cache } from 'react'
import { getEventById as getEventByIdRaw } from '@/lib/events'
import { jsonLdSafe } from '@/lib/jsonld'

// Dedupe the read across generateMetadata + the component within one request.
const getEventById = cache(getEventByIdRaw)
import { breadcrumbJsonLd } from '@/lib/seo'
import { affiliateTicketUrl } from '@/lib/affiliate'

// ISR: cache the rendered page for 15 min (was force-dynamic, defeating this).
export const revalidate = 900

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Params = { locale: string; id: string }

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const e = await getEventById(params.id)
  if (!e) return { title: 'Event not found · CityBeat' }
  const isEs = params.locale === 'es'
  const headline = isEs ? e.title_es || e.title_en : e.title_en
  const title = `${headline} · CityBeat`
  const description = (isEs ? e.meta_es || e.meta_en : e.meta_en || '')?.slice(0, 160)
  const url = `${BASE}/${params.locale}/events/${e.id}`
  const ogImage = e.image_url || `/api/og?title=${encodeURIComponent(headline)}&eyebrow=${encodeURIComponent(isEs ? 'Evento' : 'Event')}`
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: `${BASE}/en/events/${e.id}`,
        es: `${BASE}/es/events/${e.id}`,
        'x-default': `${BASE}/en/events/${e.id}`,
      },
    },
    openGraph: { title, description, url, type: 'website', images: [{ url: ogImage }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function EventDetail({ params }: { params: Params }) {
  const e = await getEventById(params.id)
  if (!e) notFound()
  const isEs = params.locale === 'es'
  const title = isEs ? e.title_es || e.title_en : e.title_en
  const desc = isEs ? e.meta_es || e.meta_en : e.meta_en

  const start = new Date(e.start_date)
  const when = Number.isNaN(start.getTime())
    ? ''
    : start.toLocaleString(isEs ? 'es-MX' : 'en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })

  // Optional end time when the data model carries one (raw doc may have it even
  // though the typed PublicEvent doesn't expose it).
  const endDate = (e as any).end_date || (e as any).end_time || null
  const jsonLd = jsonLdSafe({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: e.start_date,
    ...(endDate ? { endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    // Model the venue as a Place with a real PostalAddress (not the venue name
    // reused as a full address string) so local relevance is preserved.
    ...(e.venue
      ? {
          location: {
            '@type': 'Place',
            name: e.venue,
            address: {
              '@type': 'PostalAddress',
              streetAddress: e.venue,
              addressLocality: 'El Paso',
              addressRegion: 'TX',
              addressCountry: 'US',
            },
          },
        }
      : {}),
    ...(e.image_url ? { image: [e.image_url] } : {}),
    ...(desc ? { description: desc } : {}),
    // NOTE: `offers` is intentionally omitted — the event model has no price, and
    // Google rejects an Offer without price/priceCurrency (an incomplete Offer is
    // worse than none). The affiliate ticket link is still rendered on the page.
    organizer: { '@type': 'Organization', name: 'CityBeat', url: BASE },
  })

  const breadcrumb = jsonLdSafe(
    breadcrumbJsonLd(params.locale, [
      { name: isEs ? 'Inicio' : 'Home', path: '/' },
      { name: isEs ? 'Eventos' : 'Events', path: '/events' },
      { name: title },
    ])
  )

  // Affiliate-tagged buy link (commission on ticket sales); passthrough until configured.
  const ticketHref = affiliateTicketUrl(e.ticket_url)

  return (
    <CityBeatShell locale={params.locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      <article className="container-wide max-w-3xl py-14">
        <Link
          href={withLocale(params.locale, '/events')}
          className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline"
        >
          {isEs ? '← Eventos' : '← Events'}
        </Link>

        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-brand-neon">{when}</p>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">{title}</h1>
        {e.venue && <p className="mt-3 text-lg text-white/60">{e.venue}</p>}

        {e.image_url && (
          <div className="mt-8 overflow-hidden rounded-md bg-white/5">
            <Image src={e.image_url} alt={title} width={1200} height={675} className="aspect-video w-full object-cover" />
          </div>
        )}

        {desc && <p className="mt-8 whitespace-pre-line text-lg leading-8 text-white/80">{desc}</p>}

        {ticketHref && (
          <a
            href={ticketHref}
            target="_blank"
            rel="noreferrer sponsored"
            className="mt-8 inline-block rounded-md bg-brand-neon px-6 py-3 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
          >
            {isEs ? 'Boletos / Más info' : 'Tickets / More info'}
          </a>
        )}
      </article>
    </CityBeatShell>
  )
}
