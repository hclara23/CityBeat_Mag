'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

export default function SecurityPage() {
  const locale = useLocale()
  const [loading, setLoading] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [required, setRequired] = useState(false)
  const [step, setStep] = useState<'idle' | 'enrolling'>('idle')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      // Unauthenticated → profile is null (endpoint returns 200 to avoid a
      // console error on public pages); redirect to login.
      if (!data.profile) {
        window.location.href = `/${locale}/login?redirectTo=/account/security`
        return
      }
      setMfaEnabled(Boolean(data.profile?.mfa_enabled))
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRequired(new URLSearchParams(window.location.search).get('required') === '1')
    }
    load()
  }, [load])

  const startSetup = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start setup')
      setQr(data.qrDataUrl); setSecret(data.secret); setStep('enrolling')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start setup')
    } finally { setBusy(false) }
  }

  const enable = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not enable 2FA')
      setMfaEnabled(true); setStep('idle'); setCode(''); setNotice('Two-factor authentication is now ON.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable 2FA')
    } finally { setBusy(false) }
  }

  const disable = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not disable 2FA')
      setMfaEnabled(false); setCode(''); setNotice('Two-factor authentication is OFF.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable 2FA')
    } finally { setBusy(false) }
  }

  const input = 'w-full text-center tracking-[0.4em] text-lg font-bold rounded p-2.5 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none'

  return (
    <CityBeatShell locale={locale}>
      <div className="citybeat-app min-h-screen py-12">
        <div className="container-wide max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">Account Security</p>
          <h1 className="font-display text-3xl font-black uppercase text-white mt-1">Two-Factor Authentication</h1>

          {required && !mfaEnabled && (
            <div className="mt-5 p-4 rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-sm text-brand-gold">
              Your account has admin access, so two-factor authentication is <strong>required</strong>. Enroll below to continue.
            </div>
          )}
          {notice && <div className="mt-5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">{notice}</div>}
          {error && <div className="mt-5 p-3 rounded-lg border border-brand-magenta/40 bg-brand-magenta/10 text-sm text-brand-magenta">{error}</div>}

          <div className="citybeat-panel rounded-2xl p-6 border border-white/10 mt-6">
            {loading ? (
              <p className="text-white/50 text-sm">Loading…</p>
            ) : mfaEnabled ? (
              <div className="space-y-4">
                <p className="text-sm text-emerald-300 font-bold">✓ 2FA is enabled on your account.</p>
                <p className="text-xs text-white/60">To turn it off, enter a current code from your authenticator app.</p>
                <input className={input} maxLength={6} inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
                <button onClick={disable} disabled={busy} className="w-full rounded border border-brand-magenta/40 text-brand-magenta font-black uppercase tracking-wider text-xs py-3 hover:bg-brand-magenta/10 transition disabled:opacity-50">
                  {busy ? 'Working…' : 'Disable 2FA'}
                </button>
              </div>
            ) : step === 'idle' ? (
              <div className="space-y-4">
                <p className="text-sm text-white/70 leading-relaxed">
                  Protect your account with an authenticator app (Google Authenticator, Authy, 1Password, etc.). You&apos;ll enter a 6-digit code each time you sign in.
                </p>
                <button onClick={startSetup} disabled={busy} className="w-full rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3 hover:bg-cyan-300 transition disabled:opacity-50">
                  {busy ? 'Starting…' : 'Set up 2FA'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/70">1. Scan this QR code with your authenticator app:</p>
                {qr && (
                  <div className="flex justify-center bg-white rounded-lg p-3 w-fit mx-auto">
                    <Image src={qr} alt="2FA QR code" width={200} height={200} unoptimized />
                  </div>
                )}
                <p className="text-[11px] text-white/50 text-center">Can&apos;t scan? Enter this key manually:<br/><span className="font-mono text-white/80 break-all">{secret}</span></p>
                <p className="text-sm text-white/70">2. Enter the 6-digit code it shows:</p>
                <input className={input} maxLength={6} inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
                <button onClick={enable} disabled={busy} className="w-full rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3 hover:bg-cyan-300 transition disabled:opacity-50">
                  {busy ? 'Verifying…' : 'Verify & Enable'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </CityBeatShell>
  )
}
