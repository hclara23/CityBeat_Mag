'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { EngagementBoard } from '@/components/citybeat/EngagementBoard'

export default function SalesAgentDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/sales', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.can_manage_platform && !user.is_developer) return router.push(withLocale(locale, '/'))
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

  const run = async () => {
    setRunning(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10, dryRun: !live, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Run failed')
      setMsg(`${live ? 'Sent' : 'Dry-run'}: contacted ${data.result.contacted}, follow-ups ${data.result.followups}, emails sent ${data.result.sent}`)
      await load()
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setRunning(false)
    }
  }

  if (!ready || !data) return null
  const f = data.funnel || {}
  const cards = [
    { label: 'Unclaimed left', value: data.unclaimed_remaining ?? '—' },
    { label: 'Contacted', value: f.contacted ?? 0 },
    { label: 'Opened', value: f.opened ?? 0 },
    { label: 'Clicked', value: f.clicked ?? 0 },
    { label: 'Converted', value: f.converted ?? 0 },
  ]

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-5xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Godmode</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">Automated Sales Agent</h1>
        <p className="mt-2 text-white/55">Outreach to unclaimed directory businesses — claim + Premium upsell.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">{c.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={run} disabled={running}
              className="rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-60">
              {running ? 'Running…' : 'Run outreach (10)'}
            </button>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              {live ? 'LIVE — actually send emails' : 'Dry-run (no emails sent)'}
            </label>
            {msg && <span className="text-sm text-brand-neon">{msg}</span>}
          </div>
          <p className="mt-3 text-xs text-white/40">
            Live sending requires RESEND_API_KEY + a verified citybeatmag.co sender. Personalization uses Claude when ANTHROPIC_API_KEY is set. Schedule daily via the /api/cron/sales-agent endpoint.
          </p>
        </div>

        {/* Businesses that opened / clicked outreach — hottest first. */}
        <div className="mt-8">
          <EngagementBoard />
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-white">Recent outreach</h2>
          <div className="overflow-hidden rounded-xl border border-white/10">
            {(data.recent || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-3 text-sm">
                <span className="text-white/80">{r.business_name || r.email}</span>
                <span className="text-white/50">step {r.step} · {r.status} · {r.opens || 0}o/{r.clicks || 0}c</span>
              </div>
            ))}
            {(data.recent || []).length === 0 && <p className="px-5 py-4 text-sm text-white/40">No outreach yet — run it above.</p>}
          </div>
        </div>
      </section>
    </CityBeatShell>
  )
}
