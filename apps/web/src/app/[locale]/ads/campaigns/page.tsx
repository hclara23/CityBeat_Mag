import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { getAdProducts, withLocale, type Locale } from '@/components/citybeat/content'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { redirect } from 'next/navigation'

type CampaignsPageProps = {
  params: {
    locale: string
  }
}

export const dynamic = 'force-dynamic'

export default async function CampaignsPage({ params }: CampaignsPageProps) {
  const locale = (params.locale || 'en') as Locale
  const adProducts = getAdProducts(locale)

  const user = await getServerUser()
  if (!user) {
    redirect(`/${locale}/login`)
  }

  // Fetch campaigns for this user from Firestore
  const snapshot = await adminDb.collection('campaigns').where('user_id', '==', user.id).get()
  const activeCampaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-16">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon">Advertiser Portal</p>
            <h1 className="mt-4 text-5xl font-black text-white">Your Campaigns</h1>
            <p className="mt-3 text-white/60">Upload creatives, view metrics, and manage your active sponsorships.</p>
          </div>
          <Link href={withLocale(locale, '/ads/newsletter')} className="rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black">
            New Campaign
          </Link>
        </div>

        {activeCampaigns.length > 0 ? (
          <div className="mb-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((campaign: any) => (
              <div key={campaign.id} className="citybeat-panel rounded-md p-6 border-l-4 border-l-brand-neon">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">{campaign.type || 'Campaign'}</p>
                  <span className="px-2 py-1 text-xs rounded bg-brand-neon/10 text-brand-neon">{campaign.status || 'Active'}</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Campaign #{campaign.id.substring(0, 8)}</h3>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-xs text-white/50 uppercase">Impressions</p>
                    <p className="text-2xl font-black">{campaign.impressions || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase">Clicks</p>
                    <p className="text-2xl font-black">{campaign.clicks || 0}</p>
                  </div>
                </div>
                <button className="w-full mt-6 py-2 border border-white/20 hover:bg-white/10 rounded transition text-sm">
                  Upload Creative
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="citybeat-panel mb-16 rounded-md p-8 text-center">
            <h2 className="text-3xl font-black text-white">No active campaigns yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/60">
              Choose an ad product to start a campaign. Your metrics and creative upload portal will appear here once your payment clears.
            </p>
          </div>
        )}

        <h2 className="text-3xl font-black text-white mb-6">Explore Products</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {Object.entries(adProducts).map(([key, product]) => (
            <Link key={key} href={withLocale(locale, `/ads/${key}`)} className="citybeat-panel rounded-md p-6 transition hover:border-brand-neon/40">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">{product.shortTitle}</p>
              <h2 className="mt-4 text-2xl font-black text-white">{product.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">{product.dek}</p>
            </Link>
          ))}
        </div>
      </section>
    </CityBeatShell>
  )
}
