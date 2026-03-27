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
      <section className="rounded-2xl border border-ink/10 bg-white/80 p-6">
        Loading campaign details...
      </section>
    )
  }

  if (error || !campaign) {
    return (
      <section className="space-y-4">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Campaign not found.'}
        </p>
        <Link
          href="/advertiser/campaigns"
          className="inline-block text-xs text-accent hover:underline"
        >
          Back to campaigns
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
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">{(campaign.ad_placements as any)?.name || 'Campaign'}</h2>
          <p className="mt-2 text-sm text-ink/70">
            Running from {startDate} to {endDate}
          </p>
        </div>
        <Link
          href="/advertiser/campaigns"
          className="text-xs text-accent hover:underline"
        >
          Back to campaigns
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-ink/10 bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">Status</p>
          <p className={`mt-2 text-sm font-medium capitalize ${getStatusColor(campaign.status)}`}>
            {campaign.status}
          </p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">Impressions</p>
          <p className="mt-2 text-2xl font-display">{stats.total_impressions.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">Clicks</p>
          <p className="mt-2 text-2xl font-display text-accent">{stats.total_clicks.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">Click Rate</p>
          <p className="mt-2 text-2xl font-display">{ctr}%</p>
        </div>
      </div>

      <div className="rounded-lg border border-ink/10 bg-paper p-6">
        <h3 className="font-display text-lg">Campaign Details</h3>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink/60">Campaign ID:</span>
            <span className="font-mono text-ink">{campaign.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Start Date:</span>
            <span>{startDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">End Date:</span>
            <span>{endDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Current Status:</span>
            <span className={`capitalize ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
