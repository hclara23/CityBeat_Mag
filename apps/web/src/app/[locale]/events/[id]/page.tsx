import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { getEventById } from '@/lib/events'
import { jsonLdSafe } from '@/lib/jsonld'

export const dynamic = 'force-dynamic'
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
    alternates: { canonical: url },
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

  const jsonLd = jsonLdSafe({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    startDate: e.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(e.venue ? { location: { '@type': 'Place', name: e.venue, address: e.venue } } : {}),
    ...(e.image_url ? { image: [e.image_url] } : {}),
    ...(desc ? { description: desc } : {}),
    ...(e.ticket_url ? { offers: { '@type': 'Offer', url: e.ticket_url } } : {}),
    organizer: { '@type': 'Organization', name: 'CityBeat', url: BASE },
  })

  return (
    <CityBeatShell locale={params.locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
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
            <Image src={e.image_url} alt="" width={1200} height={675} className="aspect-video w-full object-cover" />
          </div>
        )}

        {desc && <p className="mt-8 whitespace-pre-line text-lg leading-8 text-white/80">{desc}</p>}

        {e.ticket_url && (
          <a
            href={e.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-block rounded-md bg-brand-neon px-6 py-3 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
          >
            {isEs ? 'Boletos / Más info' : 'Tickets / More info'}
          </a>
        )}
      </article>
    </CityBeatShell>
  )
}
