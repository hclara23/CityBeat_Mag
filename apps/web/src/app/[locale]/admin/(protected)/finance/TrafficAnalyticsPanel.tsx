'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const providerLabel: Record<string, string> = { google: 'Google Analytics 4', cloudflare: 'Cloudflare Web Analytics', first_party: 'CityBeat first-party' }
const fmt = (value: number) => new Intl.NumberFormat('en-US', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value || 0)

export function TrafficAnalyticsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/traffic-analytics?days=${days}`, { cache: 'no-store' })
    setData(res.ok ? await res.json() : null)
    setLoading(false)
  }, [days])
  useEffect(() => { load() }, [load])

  const providers = data?.providers || {}
  const primary = providers.google?.status === 'ok' ? providers.google : providers.first_party
  const maxTrend = useMemo(() => Math.max(1, ...(primary?.trend || []).map((point: any) => point.views)), [primary])

  return (
    <section className="mt-10 border-t border-white/10 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">Audience performance</p>
          <h2 className="mt-2 text-2xl font-black text-white">Traffic analytics</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">Google measures audience and acquisition. Cloudflare independently measures real browser page loads and performance. CityBeat remains available as a first-party fallback.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-1" aria-label="Analytics date range">
          {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)} className={`rounded-md px-3 py-2 text-xs font-black ${days === value ? 'bg-brand-neon text-black' : 'text-white/55 hover:text-white'}`}>{value} days</button>)}
        </div>
      </div>

      {loading ? <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-8 text-sm text-white/50">Loading traffic sources…</div> : !data ? <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-sm text-red-200">Traffic reporting could not be loaded.</div> : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {['google', 'cloudflare', 'first_party'].map((key) => <ProviderCard key={key} report={providers[key]} />)}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Page views" value={fmt(primary?.totals?.views)} />
            <Kpi label="Active users" value={primary?.totals?.visitors ? fmt(primary.totals.visitors) : '—'} />
            <Kpi label="Sessions" value={primary?.totals?.sessions ? fmt(primary.totals.sessions) : '—'} />
            <Kpi label="Engagement" value={primary?.totals?.engagement_rate !== undefined ? `${Math.round(primary.totals.engagement_rate * 100)}%` : '—'} />
            <Kpi label="Avg. session" value={primary?.totals?.average_session_seconds ? `${Math.round(primary.totals.average_session_seconds)}s` : '—'} />
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between"><h3 className="font-bold text-white">Daily page views</h3><span className="text-xs text-white/40">{providerLabel[primary?.source] || 'Unavailable'}</span></div>
            {(primary?.trend || []).length ? <div className="mt-5 flex h-44 items-end gap-1 overflow-hidden" aria-label="Daily traffic chart">{primary.trend.map((point: any) => <div key={point.date} title={`${point.date}: ${fmt(point.views)} views`} className="min-w-[4px] flex-1 rounded-t bg-brand-neon/80 hover:bg-brand-neon" style={{ height: `${Math.max(3, point.views / maxTrend * 100)}%` }} />)}</div> : <p className="mt-4 text-sm text-white/40">No traffic has been reported for this range yet.</p>}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <RankedList title="Top pages" rows={primary?.top_pages || []} />
            <RankedList title="Acquisition channels" rows={providers.google?.channels || []} empty="Available after Google reporting access is connected." />
            <RankedList title="Top countries" rows={(providers.google?.countries?.length ? providers.google.countries : providers.cloudflare?.countries) || []} />
            <RankedList title="Devices" rows={providers.google?.devices || []} empty="Available after Google reporting access is connected." />
          </div>
          <p className="mt-4 text-xs text-white/35">Provider totals can differ because Google, Cloudflare, and CityBeat use different collection and filtering methods. Data generated {new Date(data.generated_at).toLocaleString()}.</p>
        </>
      )}
    </section>
  )
}

function ProviderCard({ report }: { report: any }) {
  const ok = report?.status === 'ok'
  return <div className={`rounded-xl border p-5 ${ok ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}><div className="flex items-center justify-between gap-2"><h3 className="font-bold text-white">{providerLabel[report?.source] || 'Provider'}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{ok ? 'Reporting' : report?.status === 'not_configured' ? 'Setup needed' : 'Unavailable'}</span></div><p className="mt-3 text-2xl font-black text-white">{ok ? fmt(report.totals.views) : '—'}</p><p className="text-xs text-white/40">page views · selected range</p>{report?.message && <p className="mt-3 text-xs leading-relaxed text-white/50">{report.message}</p>}</div>
}
function Kpi({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div> }
function RankedList({ title, rows, empty = 'No data yet.' }: { title: string; rows: any[]; empty?: string }) { const max = Math.max(1, ...rows.map((r) => r.value)); return <div className="rounded-xl border border-white/10 bg-white/5 p-6"><h3 className="font-bold text-white">{title}</h3><div className="mt-4 space-y-3">{rows.slice(0, 10).map((row) => <div key={row.label}><div className="flex justify-between gap-3 text-xs"><span className="truncate text-white/65">{row.label}</span><span className="font-bold text-white">{fmt(row.value)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-white/5"><div className="h-full rounded bg-brand-magenta" style={{ width: `${row.value / max * 100}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-white/40">{empty}</p>}</div></div> }
