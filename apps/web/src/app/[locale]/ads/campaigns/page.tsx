import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { getAdProducts, withLocale, type Locale } from '@/components/citybeat/content'

type CampaignsPageProps = {
  params: {
    locale: string
  }
}

export default function CampaignsPage({ params }: CampaignsPageProps) {
  const locale = (params.locale || 'en') as Locale
  const adProducts = getAdProducts(locale)

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon">Dashboard</p>
            <h1 className="mt-4 text-5xl font-black text-white">Campaigns</h1>
            <p className="mt-3 text-white/60">Manage ad campaigns from the main CityBeat domain.</p>
          </div>
          <Link href={withLocale(locale, '/ads/newsletter')} className="rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black">
            New Campaign
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {Object.entries(adProducts).map(([key, product]) => (
            <Link key={key} href={withLocale(locale, `/ads/${key}`)} className="citybeat-panel rounded-md p-6 transition hover:border-brand-neon/40">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">{product.shortTitle}</p>
              <h2 className="mt-4 text-2xl font-black text-white">{product.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">{product.dek}</p>
            </Link>
          ))}
        </div>

        <div className="citybeat-panel mt-8 rounded-md p-8 text-center">
          <h2 className="text-3xl font-black text-white">No active campaigns yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/60">
            Choose an ad product to start a campaign. Existing campaign metrics will appear here after the database connection is configured for the main web app.
          </p>
        </div>
      </section>
    </CityBeatShell>
  )
}
