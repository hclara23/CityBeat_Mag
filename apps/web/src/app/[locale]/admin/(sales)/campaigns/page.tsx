'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

interface Campaign {
  id: string
  name: string
  advertiser_name: string
  objective: string
  headline: string
  body_copy: string
  call_to_action: string
  target_url: string
  logo_url: string | null
  creative_url: string | null
  status: string
  is_active: boolean
  created_at: string
  sold_by_rep: string | null
  contact_email: string | null
  sales_order_id: string | null
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-400/15 text-amber-300',
  running: 'bg-emerald-400/15 text-emerald-300',
  rejected: 'bg-red-400/15 text-red-300',
  past_due: 'bg-orange-400/15 text-orange-300',
  cancelled: 'bg-white/10 text-white/50',
}

export default function AdminCampaignsPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'running' | 'rejected'>('pending_review')

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/campaigns')
      if (res.status === 401 || res.status === 403) {
        setIsAuthorized(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns || [])
        setIsAuthorized(true)
      }
    } catch (err) {
      console.error('Failed to load campaigns', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }
      load()
    })
  }, [router, locale, load])

  const handleModerate = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating campaign')
    }
  }

  if (!isLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-white/70">Sales Desk access required to manage newsletter sponsorships.</p>
        </main>
      </div>
    )
  }

  const visible = filter === 'all' ? campaigns : campaigns.filter((c) => (c.status || 'pending_review') === filter)
  const pendingCount = campaigns.filter((c) => (c.status || 'pending_review') === 'pending_review').length

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-4">
              <Link href={withLocale(locale, '/admin/sales/me')} className="text-sm text-brand-neon hover:underline">
                ← Back to Sales Desk
              </Link>
            </div>
            <h1 className="font-display text-4xl font-black uppercase tracking-tight">Newsletter Sponsorships</h1>
            <p className="mt-1 text-white/50 text-sm">
              Every paid newsletter sponsorship lands here for review before it starts running in the newsletter.
              {pendingCount > 0 && <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">{pendingCount} awaiting review</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['pending_review', 'running', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${filter === f ? 'bg-brand-neon text-brand-ink' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-white/50 py-10">Loading sponsorships...</div>
        ) : visible.length === 0 ? (
          <div className="citybeat-panel p-8 text-center text-white/50">No newsletter sponsorships in this view.</div>
        ) : (
          <div className="grid gap-6">
            {visible.map((c) => {
              const status = c.status || 'pending_review'
              return (
                <div key={c.id} className="citybeat-panel flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold">{c.advertiser_name || c.name || '(untitled)'}</h3>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[status] || STATUS_STYLES.pending_review}`}>
                          {status.replace('_', ' ')}
                        </span>
                        {c.sales_order_id && (
                          <span className="rounded bg-brand-magenta/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-magenta">Sales Desk</span>
                        )}
                      </div>
                      <p className="text-sm text-brand-gold uppercase tracking-wider font-bold">{c.headline}</p>
                    </div>
                    {c.contact_email && <p className="text-xs text-white/40">Contact: {c.contact_email}</p>}
                  </div>

                  {c.body_copy && <p className="text-sm text-white/60 line-clamp-3">{c.body_copy}</p>}

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                    {c.target_url && (
                      <a href={c.target_url} target="_blank" rel="noreferrer" className="rounded bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20">
                        View target link
                      </a>
                    )}
                    {status !== 'running' && (
                      <button
                        onClick={() => handleModerate(c.id, 'approve')}
                        className="rounded border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-white"
                      >
                        Approve — start running
                      </button>
                    )}
                    {status !== 'rejected' && (
                      <button
                        onClick={() => handleModerate(c.id, 'reject')}
                        className="rounded border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500 hover:text-white"
                      >
                        Reject
                      </button>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-white/30">ID: {c.id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
