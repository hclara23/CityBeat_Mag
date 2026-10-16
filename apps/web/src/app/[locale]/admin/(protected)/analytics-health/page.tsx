'use client'

import { useEffect, useState } from 'react'
import { SiteHeader } from '@/components/citybeat/SiteHeader'

export default function AnalyticsHealthPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/admin/analytics-health').then(async (r) => {
      if (!r.ok) throw new Error('Could not load analytics diagnostics.')
      setData(await r.json())
    }).catch((e) => setError(e.message))
  }, [])

  return <div className="min-h-screen bg-brand-dark text-white">
    <SiteHeader />
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">Admin diagnostics</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Analytics health</h1>
      <p className="mt-2 text-sm text-white/55">Configuration truth for Google, Cloudflare, CityBeat pageviews, and business-listing analytics.</p>
      {error ? <p className="mt-8 rounded border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p> : !data ? <p className="mt-8 text-white/50">Checking…</p> : <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title="Google Analytics" ok={data.google_analytics.collection_enabled} rows={[
          ['Measurement ID', data.google_analytics.measurement_id],
          ['Browser collection', data.google_analytics.collection_enabled ? 'Enabled' : 'Disabled'],
          ['Admin reporting API', data.google_analytics.reporting_api_configured ? 'Configured' : 'Using first-party fallback'],
        ]} />
        <Card title="Cloudflare" ok={data.cloudflare.beacon_configured || data.cloudflare.traffic_proxied} rows={[
          ['DNS provider', data.cloudflare.dns_provider ? 'Cloudflare' : 'Unknown'],
          ['Traffic proxied', data.cloudflare.traffic_proxied ? 'Yes' : 'No — direct to Google'],
          ['Web Analytics beacon', data.cloudflare.beacon_configured ? 'Configured' : 'Token not configured'],
        ]} note={data.cloudflare.note} />
        <Card title="CityBeat first-party" ok={data.first_party.enabled} rows={[
          ['Collection', 'Enabled'], ['Pageviews in last 24 hours', String(data.first_party.pageviews_24h)], ['Visitor identity', 'Not stored'],
        ]} />
        <Card title="Premium conversion pixel" ok={data.premium_pixel.enabled} rows={[
          ['Availability', 'Premium and Featured listings'], ['Storage', 'Daily aggregate counters'], ['Cookies', 'None'],
        ]} />
      </div>}
      {data ? <p className="mt-6 text-xs text-white/35">Checked {new Date(data.checked_at).toLocaleString()}</p> : null}
    </main>
  </div>
}

function Card({ title, ok, rows, note }: { title: string; ok: boolean; rows: [string, string][]; note?: string }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-black uppercase">{title}</h2><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${ok ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{ok ? 'Operational' : 'Needs setup'}</span></div>
    <dl className="mt-4 space-y-3">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-t border-white/10 pt-3 text-sm"><dt className="text-white/45">{label}</dt><dd className="text-right font-bold text-white/80">{value}</dd></div>)}</dl>
    {note ? <p className="mt-4 text-xs leading-5 text-white/40">{note}</p> : null}
  </section>
}
