'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    (cents || 0) / 100
  )
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
      if (!user.can_manage_platform && !user.is_developer) {
        return router.push(withLocale(locale, '/'))
      }
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

  if (!ready || !data) return null
  const summary = data.summary || {}
  const maxMonth = Math.max(
    1,
    ...(data.monthly || []).map((month: any) => Math.max(month.incoming, month.outgoing))
  )

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-6xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Godmode</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">Finance & Analytics</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Gross billed', value: money(summary.total_gross) },
            { label: 'Discounts granted', value: money(summary.total_discounts) },
            { label: 'Net collected', value: money(summary.total_incoming) },
            { label: 'Paid out', value: money(summary.total_paid_out) },
            { label: 'Platform net', value: money(summary.platform_net) },
            { label: 'Active subs', value: String(summary.active_subscriptions ?? 0) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Monthly (net collected vs paid out)</h2>
          {(data.monthly || []).length === 0 ? (
            <p className="text-sm text-white/40">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {(data.monthly as any[]).map((month) => (
                <div key={month.month}>
                  <div className="flex justify-between text-xs text-white/50">
                    <span>{month.month}</span>
                    <span>{money(month.incoming)} in · {money(month.outgoing)} out</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <div className="h-2 rounded bg-brand-neon" style={{ width: `${(month.incoming / maxMonth) * 100}%` }} />
                    <div className="h-2 rounded bg-brand-magenta" style={{ width: `${(month.outgoing / maxMonth) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ReferralBalances rows={data.referral_balances || []} />
          <ReferralActivity rows={data.referrals || []} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Incoming payments</h2>
            <div className="max-h-[32rem] space-y-2 overflow-auto">
              {(data.incoming || []).map((payment: any) => (
                <div key={payment.id} className="rounded-lg border border-white/5 bg-black/15 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">
                        {payment.listing_name || payment.service || payment.source}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/40">
                        {[payment.plan, payment.billing_cycle, payment.email, payment.status]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white">{money(payment.amount)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-white/40">net paid</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-white/5 px-2 py-1 text-white/50">
                      Gross {money(payment.gross_amount)}
                    </span>
                    {payment.discount_amount > 0 && (
                      <span className="rounded bg-amber-400/10 px-2 py-1 font-bold text-amber-300">
                        −{money(payment.discount_amount)} {payment.discount_source === 'referral' ? 'referral discount' : 'discount'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(data.incoming || []).length === 0 && <p className="text-sm text-white/40">None yet.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Outgoing payouts</h2>
            <div className="max-h-[32rem] space-y-1 overflow-auto">
              {(data.outgoing || []).map((payment: any) => (
                <div key={payment.id} className="flex justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-white/60">{payment.service} · {payment.percent}% · {payment.status}</span>
                  <span className="font-bold text-white">{money(payment.amount)}</span>
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

function ReferralBalances({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white">Referral discount balances</h2>
      <p className="mt-1 text-xs text-white/40">Banked rewards and the discount synchronized to Stripe.</p>
      <div className="mt-4 max-h-80 space-y-2 overflow-auto">
        {rows.map((row) => (
          <div key={row.listing_id} className="rounded-lg border border-white/5 bg-black/15 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white">{row.listing_name}</p>
                <p className="mt-0.5 text-xs text-white/40">{row.discount_status.replaceAll('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-brand-neon">{row.discount_months_remaining} months</p>
                <p className="text-xs text-white/40">{row.referral_discount_percent || 0}% queued/applied</p>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-white/40">No referral rewards yet.</p>}
      </div>
    </div>
  )
}

function ReferralActivity({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white">Referral activity</h2>
      <p className="mt-1 text-xs text-white/40">Who referred whom, eligibility dates, and reward status.</p>
      <div className="mt-4 max-h-80 space-y-2 overflow-auto">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-white/5 bg-black/15 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{row.referrer_listing_name} → {row.referred_listing_name}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {row.status === 'qualified'
                    ? `Qualified ${row.qualified_at ? new Date(row.qualified_at).toLocaleDateString() : ''} · ${row.reward_months} reward months`
                    : `Eligible ${row.eligible_at ? new Date(row.eligible_at).toLocaleDateString() : '—'}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${row.status === 'qualified' ? 'bg-emerald-400/15 text-emerald-300' : row.status === 'pending' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                {row.status}
              </span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-white/40">No referred signups yet.</p>}
      </div>
    </div>
  )
}
