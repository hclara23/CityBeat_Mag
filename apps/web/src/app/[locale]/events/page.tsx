import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { getUpcomingEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const revalidate = 900

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const isEs = params.locale === 'es'
  const title = isEs ? 'Eventos en El Paso y Juárez · CityBeat' : 'Events in El Paso & Juárez · CityBeat'
  const description = isEs
    ? 'Qué hacer esta semana en El Paso, Las Cruces y Ciudad Juárez: conciertos, mercados, arte y más.'
    : "What's on this week in El Paso, Las Cruces & Ciudad Juárez — concerts, markets, art, and more."
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/${params.locale}/events` },
    openGraph: { title, description, type: 'website' },
  }
}

function fmt(date: string, locale: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default async function EventsIndex({ params }: { params: { locale: string } }) {
  const isEs = params.locale === 'es'
  const events = await getUpcomingEvents()

  return (
    <CityBeatShell locale={params.locale}>
      <section className="container-wide max-w-4xl py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-white md:text-5xl">
              {isEs ? 'Eventos' : 'Events'}
            </h1>
            <p className="mt-2 text-white/60">
              {isEs ? 'Qué hacer en la frontera esta semana.' : "What's on across the borderland this week."}
            </p>
          </div>
          <Link
            href={withLocale(params.locale, '/events/submit')}
            className="rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
          >
            {isEs ? 'Enviar evento' : 'Submit an event'}
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-white/55">{isEs ? 'No hay eventos próximos todavía.' : 'No upcoming events yet.'}</p>
            <Link href={withLocale(params.locale, '/events/submit')} className="mt-3 inline-block text-sm font-bold text-brand-neon hover:underline">
              {isEs ? 'Sé el primero en enviar uno →' : 'Be the first to submit one →'}
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={withLocale(params.locale, `/events/${e.id}`)}
                  className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-brand-neon/40"
                >
                  {e.image_url && (
                    <div className="aspect-[16/9] overflow-hidden bg-white/5">
                      <Image src={e.image_url} alt="" width={760} height={428} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-neon">{fmt(e.start_date, params.locale)}</p>
                    <h2 className="mt-1 font-display text-lg font-bold text-white group-hover:text-brand-neon">
                      {isEs ? e.title_es || e.title_en : e.title_en}
                    </h2>
                    {e.venue && <p className="mt-1 text-sm text-white/45">{e.venue}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </CityBeatShell>
  )
}
