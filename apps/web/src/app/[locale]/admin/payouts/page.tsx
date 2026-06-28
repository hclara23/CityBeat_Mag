'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

const SERVICES = ['directory', 'ad_campaign', 'sponsored_post'] as const

export default function PayoutSettingsDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [ovUser, setOvUser] = useState('')
  const [ovService, setOvService] = useState<string>('directory')
  const [ovPercent, setOvPercent] = useState('')
  // Issue-a-payout-now form
  const [payUser, setPayUser] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payMsg, setPayMsg] = useState('')
  const [payBusy, setPayBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/payout-settings', { cache: 'no-store' })
    if (res.ok) setSettings((await res.json()).settings)
  }, [])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.can_manage_platform && !user.is_developer) return router.push(withLocale(locale, '/'))
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

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

  const addOverride = () => {
    if (!ovUser.trim() || !ovPercent) return
    const user_overrides = { ...(settings.user_overrides || {}) }
    user_overrides[ovUser.trim()] = { ...(user_overrides[ovUser.trim()] || {}), [ovService]: Number(ovPercent) }
    save({ user_overrides })
    setOvUser(''); setOvPercent('')
  }
  const removeOverride = (uid: string) => {
    const user_overrides = { ...(settings.user_overrides || {}) }
    delete user_overrides[uid]
    save({ user_overrides })
  }

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

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Default & per-service payout %</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-white/70">
              Default
              <input type="number" min={0} max={100} defaultValue={settings.default_payout_percent}
                onBlur={(e) => save({ default_payout_percent: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" />
            </label>
            {SERVICES.map((svc) => (
              <label key={svc} className="text-sm text-white/70">
                {svc}
                <input type="number" min={0} max={100} defaultValue={settings.service_payout_percent?.[svc] ?? 0}
                  onBlur={(e) => save({ service_payout_percent: { ...settings.service_payout_percent, [svc]: Number(e.target.value) } })}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" />
              </label>
            ))}
          </div>
          {saving && <p className="mt-3 text-xs text-white/40">Saving…</p>}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Per-user overrides</h2>
          <div className="flex flex-wrap gap-2">
            <input placeholder="user id / uid" value={ovUser} onChange={(e) => setOvUser(e.target.value)}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <select value={ovService} onChange={(e) => setOvService(e.target.value)}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white">
              {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="%" type="number" value={ovPercent} onChange={(e) => setOvPercent(e.target.value)}
              className="w-20 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white" />
            <button onClick={addOverride} className="rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase text-black">Add</button>
          </div>
          <div className="mt-4 space-y-2">
            {Object.entries(settings.user_overrides || {}).map(([uid, svcMap]: any) => (
              <div key={uid} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-4 py-2 text-sm">
                <span className="text-white/80">{uid}: {Object.entries(svcMap).map(([s, p]) => `${s} ${p}%`).join(', ')}</span>
                <button onClick={() => removeOverride(uid)} className="text-red-400 hover:underline">remove</button>
              </div>
            ))}
            {Object.keys(settings.user_overrides || {}).length === 0 && <p className="text-sm text-white/40">No overrides.</p>}
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
