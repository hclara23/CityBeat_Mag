'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

export default function PayoutSettingsDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [editorId, setEditorId] = useState('')
  // Issue-a-payout-now form
  const [payUser, setPayUser] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payMsg, setPayMsg] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  // Platform settings (instant claim approval)
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/payout-settings', { cache: 'no-store' })
    if (res.ok) setSettings((await res.json()).settings)
    const ps = await fetch('/api/admin/platform-settings', { cache: 'no-store' })
    if (ps.ok) setAutoApprove(Boolean((await ps.json()).settings?.auto_approve_claims))
  }, [])

  const toggleAutoApprove = async (next: boolean) => {
    setAutoApprove(next)
    await fetch('/api/admin/platform-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_approve_claims: next }),
    }).catch(() => setAutoApprove(!next))
  }

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.can_manage_platform && !user.is_developer) return router.push(withLocale(locale, '/'))
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

  useEffect(() => {
    if (settings?.editor_user_id) setEditorId(settings.editor_user_id)
  }, [settings])

  const save = async (next: any) => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/payout-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSettings(data.settings)
      setMsg(locale === 'es' ? 'Guardado.' : 'Saved.')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!ready || !settings) return null


  const issuePayout = async () => {
    const dollars = Number(payAmount)
    if (!payUser.trim() || !Number.isFinite(dollars) || dollars <= 0) {
      setPayMsg('Enter a user id and an amount greater than 0.')
      return
    }
    setPayBusy(true)
    setPayMsg('')
    try {
      const res = await fetch('/api/admin/payouts/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: payUser.trim(), amount: Math.round(dollars * 100), note: payNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payout failed')
      setPayMsg(`Paid $${(data.amount / 100).toFixed(2)} — transfer ${data.transferId}`)
      setPayUser(''); setPayAmount(''); setPayNote('')
    } catch (e: any) {
      setPayMsg(e.message)
    } finally {
      setPayBusy(false)
    }
  }

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-3xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Godmode</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">Payout Settings</h1>
        <p className="mt-2 text-white/55">Set the percentage of each payment paid out to users. Platform keeps the remainder.</p>
        {msg && <p className="mt-4 text-sm text-brand-neon">{msg}</p>}

        {/* Active multi-party commission split (App + Developer = platform balance). */}
        <div className="mt-8 rounded-xl border border-brand-magenta/30 bg-brand-magenta/[0.05] p-6">
          <h2 className="text-lg font-bold text-white">Commission split (active)</h2>
          <p className="mt-1 text-sm text-white/55">
            Only the <strong className="text-white">Editor</strong> and the <strong className="text-white">Sales rep</strong> receive
            bank transfers. <strong className="text-white">App + Developer</strong> stay in the platform balance. Channel is detected
            from who sold it.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
                  <th className="px-3 py-2">Sold by</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-center">Editor</th>
                  <th className="px-3 py-2 text-center">Sales rep</th>
                  <th className="px-3 py-2 text-center">Platform</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {[
                  ['Editor', 'Ads / sponsored', '65%', '—', '35%'],
                  ['Editor', 'Directory', '45%', '—', '55%'],
                  ['Sales rep', 'Ads / sponsored', '20%', '50%', '30%'],
                  ['Sales rep', 'Directory', '25%', '40%', '35%'],
                  ['Autonomous / organic', 'Directory', '40%', '—', '60%'],
                  ['Autonomous / organic', 'Ads / sponsored', '—', '—', '100%'],
                ].map((r, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2">{r[0]}</td>
                    <td className="px-3 py-2 text-white/60">{r[1]}</td>
                    <td className="px-3 py-2 text-center font-bold text-brand-neon">{r[2]}</td>
                    <td className="px-3 py-2 text-center font-bold text-brand-gold">{r[3]}</td>
                    <td className="px-3 py-2 text-center text-white/50">{r[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-white/35">
            Jobs, featured events, and custom field sales use the Ads / sponsored split. These rates live in{' '}
            <code className="text-white/50">lib/payouts.ts</code> (SPLIT_RATES) — tell the dev to change them.
          </p>

          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="block text-xs font-black uppercase tracking-wider text-white/50">Editor account (uid)</label>
            <p className="mb-2 text-[11px] text-white/40">The user who receives the Editor share on every sale.</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                placeholder="uid"
                className="min-w-[260px] flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
              />
              <button
                onClick={() => save({ editor_user_id: editorId.trim() })}
                disabled={saving || !editorId.trim()}
                className="rounded-md bg-brand-magenta px-4 py-2 text-sm font-black uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? '…' : 'Save editor'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Instant claim approval</h2>
              <p className="mt-1 text-sm text-white/55">
                When ON, a self-serve owner who pays is approved instantly (skips manual review).
                Rep field sales always stay pending. Default OFF.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(autoApprove)}
              onClick={() => toggleAutoApprove(!autoApprove)}
              disabled={autoApprove === null}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${autoApprove ? 'bg-brand-neon' : 'bg-white/15'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${autoApprove ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-1 text-lg font-bold text-white">Commission mode</h2>
          <p className="mb-4 text-sm text-white/55">
            How rep commission is paid on recurring subscriptions.
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              ['one_time', 'One-time', 'Pay the rep once, on the first payment.'],
              ['residual', 'Residual', 'Keep paying the rep their % on every renewal.'],
            ] as const).map(([mode, label, desc]) => {
              const active = (settings.commission_mode || 'one_time') === mode
              return (
                <button
                  key={mode}
                  onClick={() => save({ commission_mode: mode })}
                  className={`flex-1 min-w-[180px] rounded-lg border px-4 py-3 text-left transition ${
                    active ? 'border-brand-neon bg-brand-neon/10' : 'border-white/15 bg-black/20 hover:border-white/30'
                  }`}
                >
                  <span className={`block text-sm font-black uppercase tracking-wide ${active ? 'text-brand-neon' : 'text-white'}`}>
                    {label}{active ? ' ✓' : ''}
                  </span>
                  <span className="mt-1 block text-xs text-white/50">{desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-brand-magenta/30 bg-brand-magenta/5 p-6">
          <h2 className="mb-1 text-lg font-bold text-white">Issue a payout now</h2>
          <p className="mb-4 text-sm text-white/55">
            Transfer a one-off amount from the platform balance to a user&apos;s connected bank.
            They must have finished bank onboarding (payouts enabled).
          </p>
          <div className="flex flex-wrap gap-2">
            <input placeholder="payee user id / uid" value={payUser} onChange={(e) => setPayUser(e.target.value)}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <input placeholder="amount $" type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
              className="w-28 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <input placeholder="note (optional)" value={payNote} onChange={(e) => setPayNote(e.target.value)}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <button onClick={issuePayout} disabled={payBusy}
              className="rounded-md bg-brand-magenta px-4 py-2 text-sm font-black uppercase text-white disabled:opacity-50">
              {payBusy ? 'Paying…' : 'Pay'}
            </button>
          </div>
          {payMsg && <p className="mt-3 text-sm text-brand-neon">{payMsg}</p>}
        </div>
      </section>
    </CityBeatShell>
  )
}
