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
  const isEs = locale === 'es'
  const [ready, setReady] = useState(false)

  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<Kind>('directory')
  const [businessName, setBusinessName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState<PlanId>('premium_monthly')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [listingId, setListingId] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState<'email' | 'sms' | ''>('')
  const [sentMsg, setSentMsg] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      const allowed =
        user.is_sales || user.sales_dashboard_enabled || user.can_manage_platform || user.is_developer || user.is_editor
      if (!allowed) return router.push(withLocale(locale, '/'))
      // Prefill from a leads deep-link (?business=&listingId=&email=). Read from
      // the URL directly to avoid a useSearchParams Suspense de-opt.
      try {
        const q = new URLSearchParams(window.location.search)
        if (q.get('business')) { setBusinessName(q.get('business') || ''); setStep(2) }
        if (q.get('email')) setContactEmail(q.get('email') || '')
        if (q.get('listingId')) setListingId(q.get('listingId') || '')
      } catch { /* ignore */ }
      setReady(true)
    })
  }, [router, locale])

  // Show the one-screen quick-start the first time a rep lands here.
  useEffect(() => {
    try { if (!localStorage.getItem('cb_sales_guide_seen')) setShowGuide(true) } catch { /* ignore */ }
  }, [])

  const dismissGuide = () => {
    setShowGuide(false)
    try { localStorage.setItem('cb_sales_guide_seen', '1') } catch { /* ignore */ }
  }

  const priceLabel = kind === 'directory' ? DIRECTORY_PLANS[plan].priceLabel : amount ? `$${amount}` : ''

  const sendLink = async (channel: 'email' | 'sms') => {
    setSentMsg('')
    const to = channel === 'email' ? contactEmail.trim() : phone.trim()
    if (!to) return setSentMsg(channel === 'email' ? 'Add a client email in step 2 first.' : 'Add a client phone in step 2 first.')
    setSending(channel)
    try {
      const res = await fetch('/api/sales/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: checkoutUrl,
          email: channel === 'email' ? to : '',
          phone: channel === 'sms' ? to : '',
          businessName: businessName.trim(),
          priceLabel,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) setSentMsg(channel === 'email' ? '✓ Payment link emailed to the client' : '✓ Payment link texted to the client')
      else if (d?.results?.sms?.error === 'sms_not_configured') setSentMsg('Texting isn’t set up yet (needs Twilio). Email works now.')
      else setSentMsg(d.error || 'Could not send — try copying the link instead.')
    } catch {
      setSentMsg('Could not send — try copying the link instead.')
    } finally {
      setSending('')
    }
  }

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
          listingId: listingId || undefined,
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
    setStep(1); setKind('directory'); setBusinessName(''); setContactEmail(''); setPhone('')
    setPlan('premium_monthly'); setAmount(''); setDescription(''); setCheckoutUrl(''); setError(''); setCopied(false); setSentMsg('')
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(checkoutUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  if (!ready) return null

  const input = 'w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/30'
  const qr = checkoutUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkoutUrl)}` : ''

  const guideSteps: [string, string][] = [
    ['1 · Pick what you’re selling', 'Directory listing (recurring) or a custom one-off amount for an ad or banner.'],
    ['2 · Add the client', 'Business name, plus their email (for the receipt) and optionally a phone to text the link.'],
    ['3 · Charge them', 'Tap “Generate payment link.” Show the QR to scan, or email/text the link. Stripe sends the receipt — the sale is credited to you.'],
  ]

  return (
    <CityBeatShell locale={locale}>
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={dismissGuide}>
          <div className="w-full max-w-md rounded-2xl border border-brand-neon/30 bg-brand-charcoal p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Quick start</p>
            <h2 className="mt-1 font-display text-2xl font-black text-white">Close a sale in one screen</h2>
            <div className="mt-4 space-y-3">
              {guideSteps.map(([t, d]) => (
                <div key={t} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-black text-brand-neon">{t}</p>
                  <p className="mt-0.5 text-sm text-white/70">{d}</p>
                </div>
              ))}
            </div>
            <button onClick={dismissGuide} className="mt-5 w-full rounded-md bg-brand-neon px-4 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300">
              Got it — let’s sell
            </button>
          </div>
        </div>
      )}
      <section className="container-wide max-w-2xl py-14">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Sales</p>
          <button onClick={() => setShowGuide(true)} className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white">
            ? How it works
          </button>
        </div>
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
              Client email (for the receipt + payment link)
              <input className={`mt-1 ${input}`} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="owner@business.com" />
            </label>
            <label className="block text-sm text-white/70">
              Client phone <span className="text-white/30">(optional — to text the link)</span>
              <input className={`mt-1 ${input}`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 915 555 0100" />
            </label>

            {kind === 'directory' ? (
              <>
                <label className="block text-sm text-white/70">
                  Plan
                  <select className={`mt-1 ${input}`} value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                    {DIR_PLANS.map((p) => (
                      <option key={p} value={p}>{DIRECTORY_PLANS[p].label} — {DIRECTORY_PLANS[p].priceLabel}</option>
                    ))}
                  </select>
                </label>

                {/* Live preview — show the client what they're buying */}
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/40">{isEs ? 'Vista previa' : 'Live preview'}</p>
                  <div className={`rounded-xl border p-5 ${DIRECTORY_PLANS[plan].tier === 'featured' ? 'border-brand-gold/50 bg-brand-gold/5' : 'border-brand-neon/40 bg-brand-neon/5'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-black text-white">{businessName.trim() || (isEs ? 'Tu negocio' : 'Your Business')}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${DIRECTORY_PLANS[plan].tier === 'featured' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-neon/20 text-brand-neon'}`}>
                        {DIRECTORY_PLANS[plan].tier}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/55">★ 5.0 · {isEs ? 'Foto, horarios, enlaces sociales' : 'Photo gallery, hours, social links'}</p>
                    <p className="mt-2 text-xs text-white/40">
                      {DIRECTORY_PLANS[plan].tier === 'featured'
                        ? (isEs ? 'Aparece en la cima de su categoría + rotación en la página principal.' : 'Top of category + homepage rotation.')
                        : (isEs ? 'Colocación prioritaria sobre las fichas básicas.' : 'Priority placement above basic listings.')}
                    </p>
                  </div>
                </div>
              </>
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
            <p className="text-sm text-white/70">Have the client scan this to pay now — or send them the link below.</p>
            {qr && <img src={qr} alt="Payment QR code" width={220} height={220} className="mx-auto rounded-lg bg-white p-2" />}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300">Open checkout</a>
              <button onClick={copy} className="rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">{copied ? 'Copied!' : 'Copy link'}</button>
            </div>

            {/* Send the link directly to the client so the sale closes on the spot. */}
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/40">Send it to the client</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => sendLink('email')}
                  disabled={sending !== ''}
                  className="rounded-md border border-brand-neon/40 px-4 py-2 text-sm font-bold text-brand-neon hover:bg-brand-neon/10 disabled:opacity-50"
                >
                  {sending === 'email' ? 'Emailing…' : '✉️ Email the link'}
                </button>
                <button
                  onClick={() => sendLink('sms')}
                  disabled={sending !== ''}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  {sending === 'sms' ? 'Texting…' : '💬 Text the link'}
                </button>
              </div>
              {sentMsg && <p className="mt-2 text-xs text-white/70">{sentMsg}</p>}
              <p className="mt-2 text-[11px] text-white/35">Stripe emails the paid receipt automatically. The sale is credited to you.</p>
            </div>

            <p className="break-all text-xs text-white/40">{checkoutUrl}</p>
            <button onClick={reset} className="text-sm font-bold text-brand-neon hover:underline">+ Start another sale</button>
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
