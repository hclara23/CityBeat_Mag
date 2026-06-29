import type { Metadata } from 'next'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 600

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const isEs = params.locale === 'es'
  const title = isEs ? 'Ofertas locales · CityBeat' : 'Local deals · CityBeat'
  const description = isEs
    ? 'Descuentos y promociones de negocios locales en El Paso, Las Cruces y Ciudad Juárez.'
    : 'Discounts and coupons from local businesses across El Paso, Las Cruces & Ciudad Juárez.'
  return { title, description, alternates: { canonical: `${BASE}/${params.locale}/deals` }, openGraph: { title, description, type: 'website' } }
}

async function activeDeals() {
  try {
    const snap = await adminDb.collection('deals').where('status', '==', 'active').get()
    const now = Date.now()
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((d) => !d.expires_at || Date.parse(d.expires_at) >= now)
      .slice(0, 100)
  } catch {
    return []
  }
}

export default async function DealsPage({ params }: { params: { locale: string } }) {
  const isEs = params.locale === 'es'
  const deals = await activeDeals()

  return (
    <CityBeatShell locale={params.locale}>
      <section className="container-wide max-w-4xl py-14">
        <h1 className="font-display text-4xl font-black tracking-tight text-white md:text-5xl">{isEs ? 'Ofertas locales' : 'Local deals'}</h1>
        <p className="mt-2 text-white/60">{isEs ? 'Descuentos de negocios de la frontera.' : 'Discounts from borderland businesses.'}</p>

        {deals.length === 0 ? (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-10 text-center text-white/55">
            {isEs ? 'No hay ofertas activas todavía.' : 'No active deals yet.'}
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {deals.map((d) => (
              <div key={d.id} className="flex flex-col rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold">{isEs ? 'Oferta' : 'Deal'}</p>
                <h2 className="mt-1 font-display text-xl font-black text-white">{d.title}</h2>
                {d.description && <p className="mt-2 text-sm text-white/60">{d.description}</p>}
                {d.code && (
                  <p className="mt-3 text-sm text-white/80">
                    {isEs ? 'Código:' : 'Code:'} <span className="rounded bg-white/10 px-2 py-0.5 font-mono font-bold text-brand-gold">{d.code}</span>
                  </p>
                )}
                <div className="mt-auto pt-4">
                  {d.listing_id && (
                    <Link href={withLocale(params.locale, `/directory/${d.listing_id}`)} className="text-sm font-bold text-brand-neon hover:underline">
                      {d.business_name || (isEs ? 'Ver negocio' : 'View business')} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
