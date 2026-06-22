'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
}

export default function PaymentsDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [account, setAccount] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/platform/connect/account', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/platform/connect/balance', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ])
    setAccount(a.account || null)
    setBalance(b || null)
  }, [])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) {
        router.push(withLocale(locale, '/login?redirectTo=/account/payments'))
        return
      }
      load().finally(() => setReady(true))
    })
  }, [router, locale, load])

  const connectBank = async () => {
    setConnecting(true)
    setError('')
    try {
      const res = await fetch('/api/platform/connect/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: `/${locale}/account/payments`, refreshUrl: `/${locale}/account/payments` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start onboarding')
      window.location.href = data.url
    } catch (e: any) {
      setError(e.message)
      setConnecting(false)
    }
  }

  if (!ready) return null

  const enabled = balance?.payouts_enabled || account?.payouts_enabled
  const available = (balance?.balance?.available || []).reduce((s: number, x: any) => s + (x.amount || 0), 0)
  const pending = (balance?.balance?.pending || []).reduce((s: number, x: any) => s + (x.amount || 0), 0)

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-4xl py-14">
        <h1 className="font-display text-4xl font-black tracking-tight text-white">
          {locale === 'es' ? 'Pagos y Banco' : 'Payments & Bank'}
        </h1>
        <p className="mt-2 text-white/55">
          {locale === 'es'
            ? 'Conecta tu cuenta bancaria para recibir pagos y ver tu saldo.'
            : 'Connect your bank account to receive payouts and view your balance.'}
        </p>

        {error && <div className="mt-6 rounded-md bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">
                {locale === 'es' ? 'Cuenta bancaria' : 'Bank account'}
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                {enabled
                  ? locale === 'es' ? 'Conectada · pagos habilitados' : 'Connected · payouts enabled'
                  : account
                    ? locale === 'es' ? 'Configuración incompleta' : 'Setup incomplete'
                    : locale === 'es' ? 'No conectada' : 'Not connected'}
              </p>
            </div>
            <button
              onClick={connectBank}
              disabled={connecting}
              className="rounded-md bg-brand-neon px-5 py-2.5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {connecting
                ? '…'
                : enabled
                  ? locale === 'es' ? 'Administrar' : 'Manage'
                  : locale === 'es' ? 'Conectar banco' : 'Connect bank'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/40">{locale === 'es' ? 'Disponible' : 'Available'}</p>
            <p className="mt-2 text-3xl font-black text-white">{money(available)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/40">{locale === 'es' ? 'Pendiente' : 'Pending'}</p>
            <p className="mt-2 text-3xl font-black text-white">{money(pending)}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-white">{locale === 'es' ? 'Pagos recibidos' : 'Payouts received'}</h2>
          {(balance?.transfers || []).length === 0 ? (
            <p className="text-sm text-white/45">{locale === 'es' ? 'Aún no hay pagos.' : 'No payouts yet.'}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              {(balance.transfers as any[]).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-3 text-sm">
                  <span className="text-white/70">{t.service} · {t.percent}%</span>
                  <span className="font-bold text-white">{money(t.amount, t.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </CityBeatShell>
  )
}
