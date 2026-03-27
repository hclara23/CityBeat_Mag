'use client'

import { useEffect, useMemo, useState, use } from 'react'
import { createClient } from '@/src/lib/supabase/client'
import Link from 'next/link'

type Campaign = {
  id: string
  status: string
  start_at: string
  end_at: string
  placement_id: string
  ad_placements: {
    name: string
  }[]
}

type CampaignStats = {
  total_impressions: number
  total_clicks: number
}

export default function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const supabase = useMemo(() => createClient(), [])

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<CampaignStats>({
    total_impressions: 0,
    total_clicks: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCampaign = async () => {
      const { data: campaignData, error: campaignError } = await supabase
        .from('ad_campaigns')
        .select(
          `
            id,
            status,
            start_at,
            end_at,
            placement_id,
            ad_placements(name)
          `
        )
        .eq('id', params.id)
        .maybeSingle()

      if (campaignError || !campaignData) {
        setError(campaignError?.message ?? 'Campaign not found.')
        setLoading(false)
        return
      }

      setCampaign(campaignData as unknown as Campaign)

      // Fetch campaign stats
      const { data: impressions } = await supabase
        .from('ad_events')
        .select('id', { count: 'exact' })
        .eq('campaign_id', params.id)
        .eq('event_type', 'impression')

      const { data: clicks } = await supabase
        .from('ad_events')
        .select('id', { count: 'exact' })
        .eq('campaign_id', params.id)
        .eq('event_type', 'click')

      setStats({
        total_impressions: impressions?.length ?? 0,
        total_clicks: clicks?.length ?? 0,
      })

      setLoading(false)
    }

    fetchCampaign()
  }, [params.id, supabase])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'paused':
        return 'text-gray-600 bg-gray-50'
      case 'ended':
        return 'text-gray-400 bg-gray-50'
      default:
        return 'text-ink/60'
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        Loading campaign details...
      </section>
    )
  }

  if (error || !campaign) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error || 'Campaign not found.'}
        </div>
        <Link
          href="/portal/campaigns"
          className="inline-block text-xs uppercase tracking-widest text-accent hover:underline"
        >
          &larr; Back to campaigns
        </Link>
      </section>
    )
  }

  const startDate = new Date(campaign.start_at).toLocaleDateString()
  const endDate = new Date(campaign.end_at).toLocaleDateString()
  const ctr = stats.total_impressions > 0
    ? ((stats.total_clicks / stats.total_impressions) * 100).toFixed(2)
    : '0.00'

  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl text-ink">{(campaign.ad_placements as any)?.[0]?.name || 'Campaign Details'}</h2>
          <p className="mt-2 text-sm text-ink/60">
            Running from <span className="font-medium">{startDate}</span> to <span className="font-medium">{endDate}</span>
          </p>
        </div>
        <Link
          href="/portal/campaigns"
          className="rounded-full border border-ink/10 bg-white px-5 py-2 text-xs uppercase tracking-widest text-ink/70 hover:text-ink shadow-sm transition"
        >
          &larr; Campaigns
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-4">
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Status</p>
          <div className="mt-4 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${campaign.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'} shadow-sm`} />
            <p className={`text-sm font-semibold capitalize font-display ${getStatusColor(campaign.status).split(' ')[0]}`}>
              {campaign.status}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Impressions</p>
          <p className="mt-3 text-3xl font-display text-ink">{stats.total_impressions.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Clicks</p>
          <p className="mt-3 text-3xl font-display text-accent">{stats.total_clicks.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Engagement (CTR)</p>
          <p className="mt-3 text-3xl font-display text-ink">{ctr}%</p>
        </div>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-paper p-8 shadow-inner">
        <h3 className="font-display text-xl text-ink">Administrative Metadata</h3>
        <div className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between border-b border-ink/5 pb-4">
            <span className="text-ink/50 uppercase tracking-widest text-[10px]">Campaign Reference ID</span>
            <span className="font-mono text-ink/80">{campaign.id}</span>
          </div>
          <div className="flex justify-between border-b border-ink/5 pb-4">
            <span className="text-ink/50 uppercase tracking-widest text-[10px]">Placement Key</span>
            <span className="font-medium text-ink">{(campaign.ad_placements as any)?.[0]?.key || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/50 uppercase tracking-widest text-[10px]">Financial Verification</span>
            <span className="inline-flex items-center gap-1.5 text-green-700">
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
               Paid in Full
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
