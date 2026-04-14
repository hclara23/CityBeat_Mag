import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { adProducts, withLocale } from '@/components/citybeat/content'

type AdsPageProps = {
  params: {
    locale: string
  }
}

export default function AdsPage({ params }: AdsPageProps) {
  const locale = params.locale || 'en'

  return (
    <CityBeatShell locale={locale}>
      <section className="relative overflow-hidden border-b border-white/10 py-24">
        <div className="absolute inset-0 citybeat-grid opacity-60" />
        <div className="container-wide relative z-10">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon">Advertise</p>
            <h1 className="mt-5 text-balance font-display text-5xl font-black leading-[0.92] text-white md:text-7xl">
              Reach readers where local decisions happen.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              CityBeat placements now live under the main site. Build a campaign for newsletter, sponsored story, or category banner inventory from one domain.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-wide grid gap-6 lg:grid-cols-3">
          {Object.entries(adProducts).map(([key, product]) => (
            <Link
              key={key}
              href={withLocale(locale, `/ads/${key}`)}
              className="citybeat-panel group overflow-hidden rounded-md transition hover:-translate-y-1 hover:border-brand-neon/40"
            >
              <Image src={product.image} alt="" width={1100} height={760} className="aspect-[16/10] w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
              <div className="p-7">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{product.shortTitle}</p>
                <h2 className="mt-3 text-3xl font-black text-white">{product.title}</h2>
                <p className="mt-4 text-sm leading-6 text-white/60">{product.dek}</p>
                <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5">
                  <div>
                    <p className="text-4xl font-black text-white">{product.price}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/35">{product.cadence}</p>
                  </div>
                  <span className="rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase tracking-wider text-black">
                    Start
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-brand-charcoal/70 py-16">
        <div className="container-wide grid gap-8 md:grid-cols-3">
          {[
            ['50,000+', 'monthly bilingual readers across the region'],
            ['5', 'core coverage zones for focused local placement'],
            ['24 hr', 'campaign review target for submitted creative'],
          ].map(([value, label]) => (
            <div key={value}>
              <p className="text-5xl font-black text-brand-neon">{value}</p>
              <p className="mt-3 text-sm uppercase tracking-[0.2em] text-white/50">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="container-wide flex flex-col justify-between gap-6 rounded-md border border-white/10 bg-black/35 p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-black text-white">Campaign dashboard</h2>
            <p className="mt-2 text-white/60">Track campaign status and order history from the main CityBeat domain.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={withLocale(locale, '/ads/campaigns')} className="rounded-md border border-white/20 px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-white hover:bg-white/10">
              Campaigns
            </Link>
            <Link href={withLocale(locale, '/ads/orders')} className="rounded-md bg-brand-neon px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300">
              Orders
            </Link>
          </div>
        </div>
      </section>
    </CityBeatShell>
  )
}
