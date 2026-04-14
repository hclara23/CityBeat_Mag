import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'

type OrdersPageProps = {
  params: {
    locale: string
  }
}

export default function OrdersPage({ params }: OrdersPageProps) {
  const locale = params.locale || 'en'

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon">Billing</p>
        <h1 className="mt-4 text-5xl font-black text-white">Orders</h1>
        <p className="mt-3 max-w-2xl text-white/60">
          Advertising order history now belongs under the main CityBeat site. Payment records will appear here after Stripe and Supabase are wired into this deployment.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ['Total Orders', '0'],
            ['Active Campaigns', '0'],
            ['Total Spend', '$0'],
          ].map(([label, value]) => (
            <div key={label} className="citybeat-panel rounded-md p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-white/40">{label}</p>
              <p className="mt-4 text-5xl font-black text-brand-neon">{value}</p>
            </div>
          ))}
        </div>

        <div className="citybeat-panel mt-8 rounded-md p-8">
          <h2 className="text-3xl font-black text-white">No orders found</h2>
          <p className="mt-3 text-white/60">Start with a newsletter, sponsored story, or banner campaign.</p>
          <Link href={withLocale(locale, '/ads')} className="mt-6 inline-flex rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black">
            Browse Ad Products
          </Link>
        </div>
      </section>
    </CityBeatShell>
  )
}
