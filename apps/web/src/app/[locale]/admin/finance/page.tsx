'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

export default function FinanceDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<any>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/finance', { cache: 'no-store' })
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.can_manage_platform && !user.is_developer) return router.push(withLocale(locale, '/'))
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

  if (!ready || !data) return null
  const s = data.summary || {}
  const maxMonth = Math.max(1, ...(data.monthly || []).map((m: any) => Math.max(m.incoming, m.outgoing)))

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-5xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Godmode</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">Finance & Analytics</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Incoming', value: money(s.total_incoming) },
            { label: 'Paid out', value: money(s.total_paid_out) },
            { label: 'Platform net', value: money(s.platform_net) },
            { label: 'Active subs', value: String(s.active_subscriptions ?? 0) },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{c.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Monthly (incoming vs paid out)</h2>
          {(data.monthly || []).length === 0 ? (
            <p className="text-sm text-white/40">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {(data.monthly as any[]).map((m) => (
                <div key={m.month}>
                  <div className="flex justify-between text-xs text-white/50"><span>{m.month}</span><span>{money(m.incoming)} in · {money(m.outgoing)} out</span></div>
                  <div className="mt-1 flex gap-1">
                    <div className="h-2 rounded bg-brand-neon" style={{ width: `${(m.incoming / maxMonth) * 100}%` }} />
                    <div className="h-2 rounded bg-brand-magenta" style={{ width: `${(m.outgoing / maxMonth) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Incoming payments</h2>
            <div className="max-h-80 space-y-1 overflow-auto">
              {(data.incoming || []).map((x: any) => (
                <div key={x.id} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-white/60">{x.source}{x.service ? ` · ${x.service}` : ''}</span>
                  <span className="font-bold text-white">{money(x.amount)}</span>
                </div>
              ))}
              {(data.incoming || []).length === 0 && <p className="text-sm text-white/40">None yet.</p>}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Outgoing payouts</h2>
            <div className="max-h-80 space-y-1 overflow-auto">
              {(data.outgoing || []).map((x: any) => (
                <div key={x.id} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-white/60">{x.service} · {x.percent}% · {x.status}</span>
                  <span className="font-bold text-white">{money(x.amount)}</span>
                </div>
              ))}
              {(data.outgoing || []).length === 0 && <p className="text-sm text-white/40">None yet.</p>}
            </div>
          </div>
        </div>
      </section>
    </CityBeatShell>
  )
}
