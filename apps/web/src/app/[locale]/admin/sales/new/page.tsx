'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { DIRECTORY_PLANS, type PlanId } from '@/lib/pricing'

type Kind = 'directory' | 'custom'
const DIR_PLANS: PlanId[] = ['founding', 'premium_monthly', 'premium_annual', 'featured_monthly']

export default function SalesWizard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)

  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<Kind>('directory')
  const [businessName, setBusinessName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [plan, setPlan] = useState<PlanId>('premium_monthly')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      const allowed =
        user.is_sales || user.sales_dashboard_enabled || user.can_manage_platform || user.is_developer || user.is_editor
      if (!allowed) return router.push(withLocale(locale, '/'))
      setReady(true)
    })
  }, [router, locale])

  const generate = async () => {
    setError('')
    if (!businessName.trim()) return setError('Enter the business name.')
    if (kind === 'custom' && !(Number(amount) > 0)) return setError('Enter an amount greater than 0.')
    setBusy(true)
    try {
      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          businessName: businessName.trim(),
          contactEmail: contactEmail.trim(),
          plan,
          amount: kind === 'custom' ? Number(amount) : undefined,
          description: description.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not create checkout')
      setCheckoutUrl(data.url)
      setStep(3)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep(1); setKind('directory'); setBusinessName(''); setContactEmail('')
    setPlan('premium_monthly'); setAmount(''); setDescription(''); setCheckoutUrl(''); setError(''); setCopied(false)
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(checkoutUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  if (!ready) return null

  const input = 'w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/30'
  const qr = checkoutUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkoutUrl)}` : ''

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-2xl py-14">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Sales</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">New sale / onboard a client</h1>
        <p className="mt-2 text-white/55">Generate a payment link to charge a business on the spot. The sale is credited to you.</p>

        <div className="mt-6 flex gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
          <span className={step >= 1 ? 'text-brand-neon' : ''}>1 · Product</span>
          <span>›</span>
          <span className={step >= 2 ? 'text-brand-neon' : ''}>2 · Client</span>
          <span>›</span>
          <span className={step >= 3 ? 'text-brand-neon' : ''}>3 · Charge</span>
        </div>

        {error && <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}

        {/* Step 1 — what are you selling */}
        {step === 1 && (
          <div className="mt-6 space-y-3">
            {([
              ['directory', 'Directory listing', 'Recurring subscription — Premium or Featured placement.'],
              ['custom', 'Ad / custom amount', 'One-off charge for a banner, sponsored post, or any negotiated amount.'],
            ] as const).map(([k, label, desc]) => (
              <button
                key={k}
                onClick={() => { setKind(k); setStep(2) }}
                className="block w-full rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-brand-neon/50 hover:bg-brand-neon/5"
              >
                <span className="block text-base font-black uppercase tracking-wide text-white">{label}</span>
                <span className="mt-1 block text-sm text-white/55">{desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — client + product details */}
        {step === 2 && (
          <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
            <label className="block text-sm text-white/70">
              Business name
              <input className={`mt-1 ${input}`} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Joe's Tacos" />
            </label>
            <label className="block text-sm text-white/70">
              Client email (for the receipt)
              <input className={`mt-1 ${input}`} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="owner@business.com" />
            </label>

            {kind === 'directory' ? (
              <label className="block text-sm text-white/70">
                Plan
                <select className={`mt-1 ${input}`} value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                  {DIR_PLANS.map((p) => (
                    <option key={p} value={p}>{DIRECTORY_PLANS[p].label} — {DIRECTORY_PLANS[p].priceLabel}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block text-sm text-white/70">
                  Amount (USD)
                  <input className={`mt-1 ${input}`} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="150.00" />
                </label>
                <label className="block text-sm text-white/70">
                  What for? (appears on the receipt)
                  <input className={`mt-1 ${input}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Category banner — 1 month" />
                </label>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(1)} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-white/70 hover:text-white">← Back</button>
              <button onClick={generate} disabled={busy} className="flex-1 rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300 disabled:opacity-50">
                {busy ? 'Generating…' : 'Generate payment link'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — hand off the payment link */}
        {step === 3 && checkoutUrl && (
          <div className="mt-6 space-y-4 rounded-xl border border-brand-neon/30 bg-brand-neon/5 p-6 text-center">
            <p className="text-sm text-white/70">Have the client scan this or open the link to pay now.</p>
            {qr && <img src={qr} alt="Payment QR code" width={220} height={220} className="mx-auto rounded-lg bg-white p-2" />}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300">Open checkout</a>
              <button onClick={copy} className="rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">{copied ? 'Copied!' : 'Copy link'}</button>
            </div>
            <p className="break-all text-xs text-white/40">{checkoutUrl}</p>
            <button onClick={reset} className="text-sm font-bold text-brand-neon hover:underline">+ Start another sale</button>
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
