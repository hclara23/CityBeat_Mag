import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

type CampaignRow = {
  id: string
  status: string
  start_at: string | null
  end_at: string | null
  stripe_session_id: string | null
  placement?: { name: string; key: string }[]
  sponsor?: { name: string }[]
}

export default async function PortalCampaignsPage() {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select(
      `
        id,
        status,
        start_at,
        end_at,
        stripe_session_id,
        placement:ad_placements(name, key),
        sponsor:sponsors(name)
      `
    )
    .order('created_at', { ascending: false })

  const list = (campaigns ?? []) as unknown as CampaignRow[]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Campaigns</h2>
        <Link
          href="/portal/campaigns/new"
          className="rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
        >
          New Campaign
        </Link>
      </div>

      <div className="space-y-3">
        {list.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/portal/campaigns/${campaign.id}`}
            className="block rounded-2xl border border-ink/10 bg-white/80 p-5 transition hover:border-accent/40 hover:bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
                  {campaign.placement?.[0]?.name ?? 'Placement'}
                </p>
                <h3 className="mt-2 font-display text-xl">
                  {campaign.sponsor?.[0]?.name ?? 'Sponsor'}
                </h3>
                <p className="mt-1 text-sm text-ink/70">
                  {campaign.start_at
                    ? new Date(campaign.start_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}{' '}
                  -{' '}
                  {campaign.end_at
                    ? new Date(campaign.end_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </p>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.2em] text-ink/60">
                <div className="flex items-center justify-end gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${campaign.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}
                  />
                  {campaign.status}
                </div>
                {campaign.stripe_session_id ? (
                  <div className="mt-2 text-[10px] opacity-70">
                    Payment ID: {campaign.stripe_session_id.slice(-8)}
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
        {list.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 text-sm text-ink/70">
            No campaigns yet. Create the first one.
          </div>
        ) : null}
      </div>
    </section>
  )
}
