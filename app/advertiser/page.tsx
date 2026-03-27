import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function AdvertiserHome() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('id, status, start_at, end_at, ad_placements(name)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: stats } = await supabase
    .from('ad_campaigns')
    .select('status', { count: 'exact' })
    .eq('created_by', user.id)

  const activeCampaigns = stats?.filter((s) => s.status === 'active').length || 0
  const totalCampaigns = stats?.length || 0

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Total Campaigns
          </p>
          <p className="text-3xl font-display text-ink">{totalCampaigns}</p>
        </div>
        <div className="rounded bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Active
          </p>
          <p className="text-3xl font-display text-accent">{activeCampaigns}</p>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-display">Recent Campaigns</h2>
          <Link
            href="/advertiser/campaigns/new"
            className="text-xs uppercase tracking-[0.2em] text-accent hover:text-accent/80"
          >
            New Campaign
          </Link>
        </div>

        {campaigns && campaigns.length > 0 ? (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/advertiser/campaigns/${campaign.id}`}
                className="block rounded border border-ink/20 p-4 hover:border-accent/50 hover:bg-paper"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display">
                      {(campaign.ad_placements as any)?.name || 'Campaign'}
                    </p>
                    <p className="text-xs text-ink/60">
                      Status: <span className="capitalize">{campaign.status}</span>
                    </p>
                  </div>
                  <p className="text-xs text-ink/60">
                    {new Date(campaign.start_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-ink/60">
            No campaigns yet.{' '}
            <Link href="/advertiser/campaigns/new" className="text-accent hover:underline">
              Create your first campaign
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
