'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { EngagementBoard } from '@/components/citybeat/EngagementBoard'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'usd' }).format((cents || 0) / 100)
}

export default function RepDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      const allowed = user.is_sales || user.sales_dashboard_enabled || user.can_manage_platform || user.is_developer || user.is_editor
      if (!allowed) return router.push(withLocale(locale, '/'))
      Promise.all([
        fetch('/api/sales/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/sales/leads', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { leads: [] })).catch(() => ({ leads: [] })),
      ]).then(([m, l]) => {
        setMe(m)
        setLeads(l?.leads || [])
        setReady(true)
      })
    })
  }, [router, locale])

  if (!ready || !me) return null
  const s = me.summary || {}

  const sellHref = (lead: any) =>
    withLocale(locale, `/admin/sales/new?business=${encodeURIComponent(lead.name || '')}&listingId=${lead.id}&email=${encodeURIComponent(lead.email || '')}`)

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-5xl py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">{isEs ? 'Ventas' : 'Sales'}</p>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">{isEs ? 'Mi panel' : 'My pipeline'}</h1>
            <a href={withLocale(locale, '/guide')} className="mt-1 inline-block text-xs font-bold text-brand-neon underline">
              📖 {isEs ? 'Guía de usuario' : 'User Guide'}
            </a>
          </div>
          <a
            href={withLocale(locale, '/admin/sales/new')}
            className="rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
          >
            {isEs ? '+ Nueva venta' : '+ New sale'}
          </a>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{isEs ? 'Comisión ganada' : 'Commission earned'}</p>
            <p className="mt-2 text-3xl font-black text-brand-neon">{money(s.commission_earned)}</p>
            <p className="mt-1 text-xs text-white/40">{s.commission_count || 0} {isEs ? 'pagos' : 'payouts'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{isEs ? 'Negocios cerrados' : 'Deals closed'}</p>
            <p className="mt-2 text-3xl font-black text-white">{s.deals_closed || 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{isEs ? 'Prospectos' : 'Open leads'}</p>
            <p className="mt-2 text-3xl font-black text-white">{leads.length}</p>
          </div>
        </div>

        {/* Warm leads — who engaged with outreach (call the clickers first) */}
        <div className="mt-8">
          <EngagementBoard />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Leaderboard */}
          <div>
            <h2 className="mb-3 text-lg font-bold text-white">{isEs ? 'Tabla de líderes' : 'Leaderboard'}</h2>
            <div className="overflow-hidden rounded-xl border border-white/10">
              {(me.leaderboard || []).length === 0 ? (
                <p className="bg-white/[0.03] px-5 py-4 text-sm text-white/45">{isEs ? 'Aún no hay comisiones.' : 'No commissions yet.'}</p>
              ) : (
                me.leaderboard.map((r: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between border-b border-white/5 px-5 py-3 text-sm ${r.me ? 'bg-brand-neon/10' : 'bg-white/[0.03]'}`}>
                    <span className="text-white/80">
                      <span className="mr-2 font-black text-white/30">{i + 1}</span>
                      {r.name}{r.me ? (isEs ? ' (tú)' : ' (you)') : ''}
                    </span>
                    <span className="font-bold text-white">{money(r.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My closed deals */}
          <div>
            <h2 className="mb-3 text-lg font-bold text-white">{isEs ? 'Mis ventas' : 'My closed deals'}</h2>
            <div className="overflow-hidden rounded-xl border border-white/10">
              {me.deals.length === 0 ? (
                <p className="bg-white/[0.03] px-5 py-4 text-sm text-white/45">{isEs ? 'Aún no hay ventas. ¡A vender!' : 'No deals yet — go close one!'}</p>
              ) : (
                me.deals.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-3 text-sm">
                    <span className="min-w-0 truncate text-white/80">{d.name}</span>
                    <span className="ml-3 shrink-0 rounded bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-white/60">{d.claim_status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Leads to work */}
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-white">{isEs ? 'Prospectos para trabajar' : 'Leads to work'}</h2>
          {leads.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-white/45">
              {isEs ? 'No hay prospectos sin reclamar ahora.' : 'No unclaimed leads right now.'}
            </p>
          ) : (
            <div className="grid gap-2">
              {leads.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{l.name}</p>
                    <p className="truncate text-xs text-white/45">
                      {[l.category, l.address, l.phone, l.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <a href={sellHref(l)} className="shrink-0 rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-cyan-300">
                    {isEs ? 'Vender' : 'Sell'}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </CityBeatShell>
  )
}
