import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { getThisWeekendEvents } from '@/lib/events'
import { jsonLdSafe } from '@/lib/jsonld'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const isEs = params.locale === 'es'
  const title = isEs
    ? 'Qué hacer este fin de semana en El Paso · CityBeat'
    : 'Things to Do in El Paso This Weekend · CityBeat'
  const description = isEs
    ? 'Los mejores eventos de este fin de semana en El Paso, Las Cruces y Ciudad Juárez: conciertos, deportes, mercados y más. Actualizado cada semana.'
    : 'The best events this weekend in El Paso, Las Cruces & Ciudad Juárez — concerts, sports, markets, and more. Updated every week.'
  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}/${params.locale}/this-weekend`,
      languages: { en: `${BASE}/en/this-weekend`, es: `${BASE}/es/this-weekend` },
    },
    openGraph: { title, description, type: 'website', url: `${BASE}/${params.locale}/this-weekend` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function fmtDay(date: string, locale: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}
function fmtTime(date: string, locale: string) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(locale === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit' })
}

export default async function ThisWeekendPage({ params }: { params: { locale: string } }) {
  const isEs = params.locale === 'es'
  const { events, label } = await getThisWeekendEvents()

  // Group by day for a scannable "Friday / Saturday / Sunday" layout.
  const byDay = new Map<string, typeof events>()
  for (const e of events) {
    const key = fmtDay(e.start_date, params.locale)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(e)
  }

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Things to do in El Paso this weekend (${label})`,
    itemListElement: events.slice(0, 25).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: e.title_en,
        startDate: e.start_date,
        ...(e.venue ? { location: { '@type': 'Place', name: e.venue } } : {}),
        url: `${BASE}/${params.locale}/events/${e.id}`,
        ...(e.image_url ? { image: [e.image_url] } : {}),
      },
    })),
  }

  return (
    <CityBeatShell locale={params.locale}>
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafe(itemList) }} />
      )}
      <section className="container-wide max-w-4xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">{label}</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white md:text-5xl">
          {isEs ? 'Qué hacer este fin de semana' : 'Things to Do This Weekend'}
        </h1>
        <p className="mt-3 max-w-2xl text-white/65">
          {isEs
            ? 'Los mejores eventos en El Paso, Las Cruces y Ciudad Juárez — actualizado cada semana por CityBeat.'
            : 'The best events across El Paso, Las Cruces & Ciudad Juárez — refreshed every week by CityBeat.'}
        </p>

        {events.length === 0 ? (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-white/60">
              {isEs ? 'No hay eventos listados para este fin de semana todavía.' : 'No events listed for this weekend yet.'}{' '}
              <Link href={withLocale(params.locale, '/events')} className="text-brand-neon underline">
                {isEs ? 'Ver todos los eventos' : 'See all events'}
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {[...byDay.entries()].map(([day, dayEvents]) => (
              <div key={day}>
                <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-wide text-white">{day}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {dayEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={withLocale(params.locale, `/events/${e.id}`)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-brand-neon/40"
                    >
                      {e.image_url && (
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-charcoal">
                          <Image src={e.image_url} alt={e.title_en} fill className="object-cover transition group-hover:scale-105" sizes="(max-width:640px) 100vw, 400px" />
                          {e.featured && (
                            <span className="absolute left-3 top-3 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                              {isEs ? 'Destacado' : 'Featured'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-neon">{fmtTime(e.start_date, params.locale)}</p>
                        <h3 className="mt-1 font-display text-lg font-black leading-tight text-white">{isEs ? e.title_es || e.title_en : e.title_en}</h3>
                        {e.venue && <p className="mt-1 text-sm text-white/60">{e.venue}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-8">
          <Link href={withLocale(params.locale, '/events')} className="rounded-md border border-white/15 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-white/80 hover:bg-white/5">
            {isEs ? 'Todos los eventos' : 'All events'}
          </Link>
          <Link href={withLocale(params.locale, '/events/submit')} className="rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300">
            {isEs ? 'Enviar tu evento' : 'Submit your event'}
          </Link>
        </div>
      </section>
    </CityBeatShell>
  )
}
