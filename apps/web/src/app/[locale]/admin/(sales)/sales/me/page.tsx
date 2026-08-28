'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { normalizeSalesEmail } from '@/lib/sales-checkout'
import {
  SALES_PRODUCT_GROUPS,
  SALES_PRODUCTS,
  type SalesProductId,
} from '@/lib/sales-products'
import { EngagementBoard } from '@/components/citybeat/EngagementBoard'
import { MyEarnings } from '@/components/citybeat/MyEarnings'
import { RecoveryLeadsBoard } from '@/components/citybeat/RecoveryLeadsBoard'
import { DIRECTORY_CATEGORIES } from '@/lib/categories'

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'usd' }).format((cents || 0) / 100)
}

const inputClass =
  'w-full border border-white/15 bg-black/35 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-brand-neon/70 focus:ring-2 focus:ring-brand-neon/10'

const NEW_DIRECTORY_PRODUCT_IDS: SalesProductId[] = [
  'directory_basic_free',
  'directory_founding_monthly',
  'directory_premium_monthly',
]

export default function SalesDesk() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const saleRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])

  const [productId, setProductId] = useState<SalesProductId>('directory_basic_free')
  const [businessName, setBusinessName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [listingId, setListingId] = useState('')
  const [directoryCategory, setDirectoryCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [checkoutPrice, setCheckoutPrice] = useState('')
  const [handoffOrder, setHandoffOrder] = useState<{
    orderId: string
    listingId: string
    businessName: string
    contactEmail: string
    phone: string
  } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [listingQrDataUrl, setListingQrDataUrl] = useState('')
  const [listingQrError, setListingQrError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [listingCopied, setListingCopied] = useState(false)
  const [sending, setSending] = useState<'email' | 'sms' | ''>('')
  const [listingSending, setListingSending] = useState<'email' | 'sms' | ''>('')
  const [sentMsg, setSentMsg] = useState('')
  const [listingSentMsg, setListingSentMsg] = useState('')
  // Salesperson verification bypass (only when creating a NEW directory listing).
  const [bypassVerification, setBypassVerification] = useState(false)
  const [attestationMethod, setAttestationMethod] = useState<'' | 'in_person_at_business' | 'personally_knows_owner'>('')
  const [attestationConfirmed, setAttestationConfirmed] = useState(false)
  const [attestationNote, setAttestationNote] = useState('')
  const [isBypassClaim, setIsBypassClaim] = useState(false)

  const product = SALES_PRODUCTS[productId]
  const useBypass = product.family === 'directory' && !listingId && bypassVerification
  const handoffReady = Boolean(checkoutUrl || listingUrl)
  const displayPrice =
    product.id === 'custom_one_time' && Number(amount) > 0 ? `${money(Math.round(Number(amount) * 100))} once` : product.priceLabel

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      const allowed =
        user.is_sales || user.sales_dashboard_enabled || user.can_manage_platform || user.is_developer || user.is_editor
      if (!allowed) return router.push(withLocale(locale, '/'))

      try {
        const query = new URLSearchParams(window.location.search)
        setBusinessName(query.get('business') || '')
        setContactEmail(query.get('email') || '')
        const queryListingId = query.get('listingId') || ''
        setListingId(queryListingId)
        if (queryListingId) setProductId('directory_premium_monthly')
        setDirectoryCategory(query.get('category') || '')
      } catch {
        // Deep-link prefill is optional.
      }

      Promise.all([
        fetch('/api/sales/me', { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null)),
        fetch('/api/sales/leads', { cache: 'no-store' }).then((response) =>
          response.ok ? response.json() : { leads: [] }
        ),
      ])
        .then(([dashboard, leadData]) => {
          setMe(dashboard)
          setLeads(leadData?.leads || [])
        })
        .finally(() => setReady(true))
    })
  }, [router, locale])

  useEffect(() => {
    let active = true
    setQrDataUrl('')
    setQrError(false)
    if (!checkoutUrl) return () => { active = false }

    QRCode.toDataURL(checkoutUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#050505', light: '#ffffff' },
    })
      .then((url) => { if (active) setQrDataUrl(url) })
      .catch(() => { if (active) setQrError(true) })

    return () => { active = false }
  }, [checkoutUrl])

  useEffect(() => {
    let active = true
    setListingQrDataUrl('')
    setListingQrError(false)
    if (!listingUrl) return () => { active = false }

    QRCode.toDataURL(listingUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#050505', light: '#ffffff' },
    })
      .then((url) => { if (active) setListingQrDataUrl(url) })
      .catch(() => { if (active) setListingQrError(true) })

    return () => { active = false }
  }, [listingUrl])

  useEffect(() => {
    if (!ready || window.location.hash !== '#new-sale') return
    requestAnimationFrame(() => saleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [ready])

  const summary = me?.summary || {}
  const closedDeals = useMemo(() => me?.deals || [], [me])

  function chooseLead(lead: any) {
    setProductId('directory_premium_monthly')
    setBusinessName(lead.name || '')
    setContactEmail(lead.email || '')
    setPhone(lead.phone || '')
    setListingId(lead.id || '')
    setDirectoryCategory(lead.category || '')
    setCheckoutUrl('')
    setListingUrl('')
    setHandoffOrder(null)
    setError('')
    resetBypass()
    requestAnimationFrame(() => saleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function selectProduct(value: SalesProductId) {
    setProductId(value)
    if (SALES_PRODUCTS[value].family !== 'directory') {
      setListingId('')
      setDirectoryCategory('')
    }
    setCheckoutUrl('')
    setListingUrl('')
    setHandoffOrder(null)
    setError('')
    setSentMsg('')
    setListingSentMsg('')
    resetBypass()
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    setError('')
    const email = normalizeSalesEmail(contactEmail)
    if (!businessName.trim()) return setError('Enter the business name.')
    if (!email) {
      return setError(
        product.billing === 'free'
          ? 'Enter the business email so the customer can receive and verify the listing claim.'
          : 'Enter the client email so Stripe and the fulfillment wizard can prefill it.'
      )
    }
    if (product.family === 'directory' && !directoryCategory.trim()) {
      return setError('Choose a directory category or type a new one.')
    }
    if (product.id === 'custom_one_time' && !(Number(amount) >= 1)) {
      return setError('Enter the manager-approved amount.')
    }
    if (product.id === 'custom_one_time' && !description.trim()) {
      return setError('Describe the manager-approved custom product.')
    }
    if (useBypass && !attestationMethod) {
      return setError(isEs ? 'Elige cómo verificaste el negocio.' : 'Choose how you verified the business.')
    }
    if (useBypass && !attestationConfirmed) {
      return setError(
        isEs
          ? 'Confirma que estás autorizado a omitir la verificación.'
          : 'Confirm you are authorized to bypass verification.'
      )
    }

    setBusy(true)
    try {
      const response = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          businessName: businessName.trim(),
          contactEmail: email,
          phone: phone.trim() || undefined,
          listingId: listingId || undefined,
          referralCode: listingId ? referralCode.trim() || undefined : undefined,
          directoryCategory:
            product.family === 'directory' ? directoryCategory.trim() : undefined,
          locale,
          amount: product.id === 'custom_one_time' ? Number(amount) : undefined,
          description: description.trim() || undefined,
          bypassVerification: useBypass || undefined,
          attestationMethod: useBypass ? attestationMethod : undefined,
          attestationAccepted: useBypass ? attestationConfirmed : undefined,
          attestationNote: useBypass ? attestationNote.trim() || undefined : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create the listing or checkout')
      if (!data.url && !data.listingUrl) {
        throw new Error('CityBeat did not return a handoff link.')
      }
      setCheckoutUrl(data.url || '')
      // A bypassed listing hands off a signed, single-use claim/accept link
      // instead of the plain public listing URL.
      setIsBypassClaim(Boolean(data.bypassClaimUrl))
      setListingUrl(data.bypassClaimUrl || data.listingUrl || '')
      setCheckoutPrice(data.priceLabel || displayPrice)
      if (data.listingId) setListingId(data.listingId)
      setHandoffOrder({
        orderId: data.orderId || '',
        listingId: data.listingId || '',
        businessName: businessName.trim(),
        contactEmail: email,
        phone: phone.trim(),
      })
      setSentMsg('')
      setListingSentMsg('')
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'Could not create checkout')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(checkoutUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setSentMsg('Copy failed. Open the checkout and copy the address from the browser.')
    }
  }

  async function copyListingLink() {
    try {
      await navigator.clipboard.writeText(listingUrl)
      setListingCopied(true)
      setTimeout(() => setListingCopied(false), 1800)
    } catch {
      setListingSentMsg('Copy failed. Open the listing and copy the address from the browser.')
    }
  }

  async function openSmsComposer(destination: string) {
    const recipient = destination.replace(/[^\d+]/g, '')
    const message = `CityBeat: secure payment link for ${handoffOrder?.businessName || 'your order'}${checkoutPrice ? ` (${checkoutPrice})` : ''}: ${checkoutUrl}`
    await navigator.clipboard.writeText(checkoutUrl).catch(() => {})
    window.location.href = `sms:${recipient}?&body=${encodeURIComponent(message)}`
  }

  async function openListingSmsComposer(destination: string) {
    const recipient = destination.replace(/[^\d+]/g, '')
    const message = `CityBeat: your directory listing for ${handoffOrder?.businessName || 'your business'} is ready. Open it and select Claim to verify ownership: ${listingUrl}`
    await navigator.clipboard.writeText(listingUrl).catch(() => {})
    window.location.href = `sms:${recipient}?&body=${encodeURIComponent(message)}`
  }

  async function sendLink(channel: 'email' | 'sms') {
    const destination = channel === 'email' ? handoffOrder?.contactEmail || '' : handoffOrder?.phone || ''
    if (!destination) return setSentMsg(channel === 'email' ? 'Add the client email first.' : 'Add a phone number first.')
    setSending(channel)
    setSentMsg('')
    try {
      const response = await fetch('/api/sales/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: checkoutUrl,
          orderId: handoffOrder?.orderId,
          email: channel === 'email' ? destination : '',
          phone: channel === 'sms' ? destination : '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.ok) {
        setSentMsg(channel === 'email' ? 'Payment link emailed.' : 'Payment link texted.')
      } else if (data?.results?.sms?.error === 'sms_not_configured') {
        await openSmsComposer(destination)
        setSentMsg('Opened your texting app with the payment message ready. The link is also copied.')
      } else {
        setSentMsg(data.error || 'Could not send the link.')
      }
    } catch {
      setSentMsg('Could not send the link. Copy it instead.')
    } finally {
      setSending('')
    }
  }

  function openListingMailto(destination: string) {
    const subject = `Your CityBeat listing for ${handoffOrder?.businessName || 'your business'}`
    const body = `Open this link, sign in with this email (${destination}), and accept ownership of your CityBeat listing: ${listingUrl}`
    window.location.href = `mailto:${destination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function sendListingLink(channel: 'email' | 'sms') {
    const destination = channel === 'email' ? handoffOrder?.contactEmail || '' : handoffOrder?.phone || ''
    if (!destination) {
      return setListingSentMsg(channel === 'email' ? 'Add the client email first.' : 'Add a phone number first.')
    }
    // A bypass claim link is a signed, single-use token URL — it must not run
    // through the server send-route (which validates against the plain listing
    // path), so hand it off via the device's email/text composer instead.
    if (isBypassClaim) {
      await navigator.clipboard.writeText(listingUrl).catch(() => {})
      if (channel === 'email') openListingMailto(destination)
      else await openListingSmsComposer(destination)
      setListingSentMsg(
        channel === 'email'
          ? 'Opened your email app with the acceptance link (also copied).'
          : 'Opened your texting app with the acceptance link (also copied).'
      )
      return
    }
    setListingSending(channel)
    setListingSentMsg('')
    try {
      const response = await fetch('/api/sales/send-listing-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: listingUrl,
          listingId: handoffOrder?.listingId,
          locale,
          email: channel === 'email' ? destination : '',
          phone: channel === 'sms' ? destination : '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.ok) {
        setListingSentMsg(channel === 'email' ? 'Listing link emailed.' : 'Listing link texted.')
      } else if (data?.results?.sms?.error === 'sms_not_configured') {
        await openListingSmsComposer(destination)
        setListingSentMsg('Opened your texting app with the claim message ready. The listing link is also copied.')
      } else {
        setListingSentMsg(data.error || 'Could not send the listing link.')
      }
    } catch {
      setListingSentMsg('Could not send the listing link. Copy it instead.')
    } finally {
      setListingSending('')
    }
  }

  function resetBypass() {
    setBypassVerification(false)
    setAttestationMethod('')
    setAttestationConfirmed(false)
    setAttestationNote('')
    setIsBypassClaim(false)
  }

  function nextSale() {
    setBusinessName('')
    setContactEmail('')
    setPhone('')
    setListingId('')
    setDirectoryCategory('')
    setAmount('')
    setDescription('')
    setProductId('directory_basic_free')
    setCheckoutUrl('')
    setListingUrl('')
    setCheckoutPrice('')
    setHandoffOrder(null)
    setSentMsg('')
    setListingSentMsg('')
    setError('')
    resetBypass()
  }

  function startNewDirectoryBusiness() {
    setListingId('')
    setProductId('directory_basic_free')
    setCheckoutUrl('')
    setListingUrl('')
    setHandoffOrder(null)
    setError('')
    setSentMsg('')
    setListingSentMsg('')
    resetBypass()
  }

  function correctSale() {
    setCheckoutUrl('')
    setListingUrl('')
    setCheckoutPrice('')
    setHandoffOrder(null)
    setQrDataUrl('')
    setListingQrDataUrl('')
    setSentMsg('')
    setListingSentMsg('')
    setIsBypassClaim(false)
    setError('Correct the details, then create a fresh checkout. The previous link should not be sent.')
  }

  if (!ready) return null

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-6xl py-10 sm:py-14">
        <header className="relative overflow-hidden border-y border-white/10 bg-white/[0.025] px-5 py-7 sm:px-8">
          <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(115deg, transparent 0 62%, rgba(0,224,209,.13) 62% 63%, transparent 63%)' }} />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-brand-magenta">CityBeat Sales Desk</p>
              <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
                {isEs ? 'Vende, cobra, entrega.' : 'Sell, collect, fulfill.'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                {isEs
                  ? 'Un producto, los datos esenciales y un enlace seguro. El cliente paga y continúa directamente a su formulario.'
                  : 'Pick a product, add the essentials, and hand off one secure link. The customer pays and continues directly into their fulfillment brief.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.14em]">
              <button
                type="button"
                onClick={() => saleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="bg-brand-neon px-4 py-2 text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {isEs ? '+ Nueva venta' : '+ New sale'}
              </button>
              <a href="/downloads/citybeat-sales-guide.pdf" download className="border border-white/20 px-4 py-2 text-white/70 hover:border-brand-neon/60 hover:text-brand-neon">
                {isEs ? 'Guía de ventas' : 'Sales guide'}
              </a>
              <a href="/downloads/citybeat-sales-desk-quick-start.pdf" download className="border border-white/20 px-4 py-2 text-white/70 hover:border-brand-neon/60 hover:text-brand-neon">
                {isEs ? 'Guía rápida' : 'Quick start'}
              </a>
              <a href={withLocale(locale, '/guide')} className="border border-white/20 px-4 py-2 text-white/70 hover:text-white">
                {isEs ? 'Guía del usuario' : 'User guide'}
              </a>
              <a href={withLocale(locale, '/admin/jobs')} className="border border-white/20 px-4 py-2 text-white/70 hover:border-brand-neon/60 hover:text-brand-neon">
                {isEs ? 'Ofertas de empleo' : 'Job postings'}
              </a>
              <a href={withLocale(locale, '/admin/campaigns')} className="border border-white/20 px-4 py-2 text-white/70 hover:border-brand-neon/60 hover:text-brand-neon">
                {isEs ? 'Patrocinios de boletín' : 'Newsletter sponsorships'}
              </a>
              <a href={withLocale(locale, '/admin/fulfillment')} className="border border-white/20 px-4 py-2 text-white/70 hover:border-brand-neon/60 hover:text-brand-neon">
                {isEs ? 'Entregas manuales' : 'Fulfillment queue'}
              </a>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['Commission earned', money(summary.commission_earned), `${summary.commission_count || 0} payouts`],
            ['Deals closed', String(summary.deals_closed || 0), 'All paid products'],
            ['Awaiting customer', String(summary.awaiting_customer || 0), 'Paid / brief open'],
            ['In fulfillment', String(summary.in_fulfillment || 0), 'Staff action'],
            ['Discounts', money(summary.discounts_granted || 0), 'Clearly recorded'],
            ['Open leads', String(leads.length), 'Ready to contact'],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-brand-charcoal px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{label}</p>
              <p className="mt-1 font-display text-3xl font-black text-white">{value}</p>
              <p className="mt-1 text-xs text-brand-neon/70">{note}</p>
            </div>
          ))}
        </div>

        <div ref={saleRef} id="new-sale" className="mt-8 scroll-mt-4 border border-brand-neon/25 bg-gradient-to-br from-brand-neon/[0.07] via-white/[0.025] to-brand-magenta/[0.04] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-neon">
                {isEs ? 'Nueva venta' : 'New sale'}
              </p>
              <h2 className="mt-1 font-display text-2xl font-black text-white">One form. No setup maze.</h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
              <span className="bg-brand-neon px-2 py-1 text-black">1 Create</span>
              <span>{product.billing === 'free' ? '2 Share' : '2 Pay'}</span>
              <span>{product.billing === 'free' ? '3 Customer claims' : '3 Claim + brief'}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
            <form onSubmit={generate} className="space-y-4">
              <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                Product
                <select disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} value={productId} onChange={(event) => selectProduct(event.target.value as SalesProductId)}>
                  {SALES_PRODUCT_GROUPS.map((group) => (
                    <optgroup key={group.family} label={group.label}>
                      {(group.family === 'directory'
                        ? listingId && productId !== 'directory_basic_free'
                          ? group.products.filter((id) => id !== 'directory_basic_free')
                          : NEW_DIRECTORY_PRODUCT_IDS
                        : group.products
                      ).map((id) => (
                        <option key={id} value={id}>{SALES_PRODUCTS[id].shortName} - {SALES_PRODUCTS[id].priceLabel}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="border-l-2 border-brand-neon bg-black/25 px-4 py-3" aria-live="polite">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-black text-white">{product.shortName}</p>
                    <p className="mt-1 max-w-xl text-sm leading-5 text-white/55">{product.description}</p>
                  </div>
                  <span className="shrink-0 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.13em] text-brand-neon">{displayPrice}</span>
                </div>
                <p className="mt-2 text-xs text-brand-gold/80">Sales angle: {product.salesAngle}</p>
              </div>

              {product.family === 'directory' && (
                <section className="border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-magenta">
                        Directory setup
                      </p>
                      <h3 className="mt-1 font-display text-xl font-black text-white">
                        {listingId ? 'Existing listing selected' : 'New business listing'}
                      </h3>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-white/45">
                        {listingId
                          ? 'This sale stays connected to the selected directory record.'
                          : product.billing === 'free'
                            ? 'CityBeat publishes a Basic listing now. The customer receives its page and claims it with their business email.'
                            : 'CityBeat publishes a Basic, claimable listing now and creates a separate Stripe checkout for the selected upgrade.'}
                      </p>
                    </div>
                    {listingId ? (
                      <button
                        type="button"
                        disabled={handoffReady}
                        onClick={startNewDirectoryBusiness}
                        className="border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/65 transition hover:border-brand-neon/60 hover:text-brand-neon disabled:opacity-40"
                      >
                        Switch to new business
                      </button>
                    ) : (
                      <span className="border border-brand-neon/30 bg-brand-neon/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-brand-neon">
                        No existing listing needed
                      </span>
                    )}
                  </div>

                  <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Directory category
                    <input
                      disabled={handoffReady}
                      className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`}
                      list="directory-category-suggestions"
                      value={directoryCategory}
                      onChange={(event) => setDirectoryCategory(event.target.value)}
                      autoComplete="off"
                      maxLength={80}
                      placeholder="Choose a suggestion or type a new category"
                    />
                    <datalist id="directory-category-suggestions">
                      {DIRECTORY_CATEGORIES.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <span className="mt-1 block normal-case tracking-normal text-white/30">
                      Existing categories are suggested, but any accurate custom category is accepted.
                    </span>
                  </label>

                  {!listingId && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={bypassVerification}
                          disabled={handoffReady}
                          onChange={(event) => setBypassVerification(event.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-brand-gold"
                        />
                        <span>
                          <span className="text-xs font-black uppercase tracking-[0.14em] text-brand-gold">
                            {isEs ? 'Omitir verificación del negocio' : 'Bypass business verification'}
                          </span>
                          <span className="mt-1 block text-xs normal-case leading-5 tracking-normal text-white/45">
                            {isEs
                              ? 'Solo si estás físicamente en el negocio o conoces personalmente al dueño. El cliente acepta la propiedad sin el código por correo. El pago nunca se omite.'
                              : 'Only if you are physically at the business or personally know the owner. The customer accepts ownership without the email-code challenge. Payment is never bypassed.'}
                          </span>
                        </span>
                      </label>

                      {bypassVerification && (
                        <div className="mt-3 space-y-3 border-l-2 border-brand-gold/50 bg-brand-gold/[0.04] px-4 py-3">
                          <fieldset>
                            <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                              {isEs ? '¿Cómo lo verificaste?' : 'How did you verify?'}
                            </legend>
                            <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
                              <input
                                type="radio"
                                name="attestationMethod"
                                checked={attestationMethod === 'in_person_at_business'}
                                disabled={handoffReady}
                                onChange={() => setAttestationMethod('in_person_at_business')}
                                className="accent-brand-gold"
                              />
                              {isEs ? 'Estoy físicamente en el negocio' : 'I am physically at the business'}
                            </label>
                            <label className="mt-1.5 flex items-center gap-2 text-sm text-white/70">
                              <input
                                type="radio"
                                name="attestationMethod"
                                checked={attestationMethod === 'personally_knows_owner'}
                                disabled={handoffReady}
                                onChange={() => setAttestationMethod('personally_knows_owner')}
                                className="accent-brand-gold"
                              />
                              {isEs ? 'Conozco personalmente al dueño' : 'I personally know the owner'}
                            </label>
                          </fieldset>

                          <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
                            {isEs ? 'Nota interna (opcional)' : 'Internal note (optional)'}
                            <input
                              disabled={handoffReady}
                              value={attestationNote}
                              onChange={(event) => setAttestationNote(event.target.value)}
                              maxLength={500}
                              className={`mt-1.5 ${inputClass} normal-case tracking-normal disabled:opacity-55`}
                              placeholder={isEs ? 'p. ej. Verifiqué la fachada y el letrero' : 'e.g. Verified the storefront and signage'}
                            />
                          </label>

                          <label className="flex cursor-pointer items-start gap-2 text-xs normal-case tracking-normal text-white/65">
                            <input
                              type="checkbox"
                              checked={attestationConfirmed}
                              disabled={handoffReady}
                              onChange={(event) => setAttestationConfirmed(event.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-brand-gold"
                            />
                            {isEs
                              ? 'Confirmo que estoy autorizado a omitir la verificación de este negocio.'
                              : 'I confirm I am authorized to bypass verification for this business.'}
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                  Business or organization
                  <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" placeholder="Mesa Studio" />
                </label>
                <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                  Client email
                  <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} autoComplete="email" placeholder="owner@example.com" />
                  <span className="mt-1 block normal-case tracking-normal text-white/30">
                    {product.billing === 'free' ? 'Receives the listing and verifies the claim.' : 'Prefills Stripe and their brief.'}
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                  Phone <span className="font-normal normal-case tracking-normal text-white/30">optional, for text handoff</span>
                  <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+1 915 555 0100" />
                </label>
                {listingId && (
                  <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Referral code <span className="font-normal normal-case tracking-normal text-white/30">optional — ask if a customer referred them</span>
                    <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} value={referralCode} onChange={(event) => setReferralCode(event.target.value)} placeholder="e.g. VARSITY4F2A" />
                  </label>
                )}
              </div>

              {product.id === 'custom_one_time' && (
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Approved amount
                    <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} type="number" min="1" max="100000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="150.00" />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-[0.14em] text-white/60">
                    Approved product
                    <input disabled={handoffReady} className={`mt-1.5 ${inputClass} disabled:cursor-not-allowed disabled:opacity-55`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe exactly what CityBeat will deliver" />
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <button type="submit" disabled={busy || handoffReady} className="bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-50">
                  {busy
                    ? product.billing === 'free' ? 'Creating free listing...' : 'Creating secure checkout...'
                    : product.billing === 'free'
                      ? 'Create free listing'
                      : `Create ${product.billing === 'subscription' ? 'recurring' : 'one-time'} checkout`}
                </button>
                <p className="text-xs leading-5 text-white/35">
                  {product.billing === 'free'
                    ? 'No payment or card. CityBeat publishes a Basic listing and creates a customer claim link.'
                    : product.billing === 'subscription'
                    ? 'Stripe charges now, securely saves the card, and renews automatically until canceled.'
                    : 'Stripe makes one card charge. No automatic renewal.'}
                </p>
              </div>
              {error && <p role="alert" className="border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            </form>

            <aside className="border border-white/10 bg-black/35 p-5">
              {!handoffReady ? (
                <div className="flex h-full min-h-64 flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">Handoff appears here</p>
                    <p className="mt-4 font-display text-3xl font-black leading-tight text-white/80">One choice. The right links.</p>
                  </div>
                  <ul className="mt-8 space-y-2 text-sm text-white/45">
                    <li>Free listing: claim link only</li>
                    <li>Paid new listing: payment + claim links</li>
                    <li>Open, QR, email, text, or copy</li>
                    <li>No card data enters CityBeat</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-5" aria-live="polite">
                  {checkoutUrl && (
                    <section className="border border-brand-neon/30 bg-brand-neon/[0.04] p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-neon">Payment link</p>
                      <p className="mt-1 font-display text-2xl font-black text-white">{checkoutPrice}</p>
                      <p className="mt-1 text-xs text-white/45">Stripe checkout for {handoffOrder?.businessName}</p>
                      {qrDataUrl ? (
                        <Image src={qrDataUrl} alt="Secure Stripe payment QR code" width={192} height={192} unoptimized className="mx-auto mt-4 bg-white p-2" />
                      ) : qrError ? (
                        <p className="mt-5 border border-brand-magenta/30 bg-brand-magenta/10 p-4 text-sm text-white/65">Payment QR unavailable. Use the link actions below.</p>
                      ) : (
                        <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center bg-white/5 text-xs font-black uppercase tracking-[0.15em] text-white/30">Building QR...</div>
                      )}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black uppercase tracking-[0.08em]">
                        <a href={checkoutUrl} target="_blank" rel="noreferrer" className="bg-brand-neon px-3 py-2.5 text-black hover:bg-cyan-300">Open</a>
                        <button type="button" onClick={copyLink} className="border border-white/20 px-3 py-2.5 text-white hover:bg-white/10">{copied ? 'Copied' : 'Copy'}</button>
                        <button type="button" onClick={() => sendLink('email')} disabled={Boolean(sending)} className="border border-brand-neon/40 px-3 py-2.5 text-brand-neon hover:bg-brand-neon/10 disabled:opacity-40">{sending === 'email' ? 'Sending...' : 'Email'}</button>
                        <button type="button" onClick={() => sendLink('sms')} disabled={Boolean(sending)} className="border border-white/20 px-3 py-2.5 text-white hover:bg-white/10 disabled:opacity-40">{sending === 'sms' ? 'Sending...' : 'Text'}</button>
                      </div>
                      {sentMsg && <p className="mt-3 text-xs text-white/55">{sentMsg}</p>}
                    </section>
                  )}

                  {listingUrl && (
                    <section className="border border-brand-magenta/35 bg-brand-magenta/[0.05] p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-magenta">
                        {isBypassClaim
                          ? isEs
                            ? 'Enlace para aceptar propiedad'
                            : 'Accept-ownership link'
                          : isEs
                            ? 'Ficha lista para reclamar'
                            : 'Listing ready to claim'}
                      </p>
                      <p className="mt-1 font-display text-xl font-black text-white">{handoffOrder?.businessName}</p>
                      <p className="mt-1 text-xs leading-5 text-white/45">
                        {isBypassClaim
                          ? isEs
                            ? `Enlace firmado de un solo uso. El cliente inicia sesión con ${handoffOrder?.contactEmail || 'el correo registrado'} y acepta la propiedad — sin código por correo.${checkoutUrl ? ' Aún completa el pago con el enlace de arriba.' : ''}`
                            : `Signed single-use link. The customer signs in with ${handoffOrder?.contactEmail || 'the recorded email'} and accepts ownership — no email code needed.${checkoutUrl ? ' They still complete payment via the link above.' : ''}`
                          : isEs
                            ? 'Comparte esta página pública. El cliente la abre y selecciona Reclamar.'
                            : 'Share this public page. The customer opens it and selects Claim.'}
                      </p>
                      {listingQrDataUrl ? (
                        <Image src={listingQrDataUrl} alt="CityBeat directory listing QR code" width={192} height={192} unoptimized className="mx-auto mt-4 bg-white p-2" />
                      ) : listingQrError ? (
                        <p className="mt-5 border border-brand-magenta/30 bg-brand-magenta/10 p-4 text-sm text-white/65">Listing QR unavailable. Use the link actions below.</p>
                      ) : (
                        <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center bg-white/5 text-xs font-black uppercase tracking-[0.15em] text-white/30">Building QR...</div>
                      )}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black uppercase tracking-[0.08em]">
                        <a href={listingUrl} target="_blank" rel="noreferrer" className="bg-brand-magenta px-3 py-2.5 text-white hover:bg-fuchsia-500">Open</a>
                        <button type="button" onClick={copyListingLink} className="border border-white/20 px-3 py-2.5 text-white hover:bg-white/10">{listingCopied ? 'Copied' : 'Copy'}</button>
                        <button type="button" onClick={() => sendListingLink('email')} disabled={Boolean(listingSending)} className="border border-brand-magenta/50 px-3 py-2.5 text-brand-magenta hover:bg-brand-magenta/10 disabled:opacity-40">{listingSending === 'email' ? 'Sending...' : 'Email'}</button>
                        <button type="button" onClick={() => sendListingLink('sms')} disabled={Boolean(listingSending)} className="border border-white/20 px-3 py-2.5 text-white hover:bg-white/10 disabled:opacity-40">{listingSending === 'sms' ? 'Sending...' : 'Text'}</button>
                      </div>
                      {listingSentMsg && <p className="mt-3 text-xs text-white/55">{listingSentMsg}</p>}
                    </section>
                  )}

                  <div className="flex items-center justify-center gap-4 border-t border-white/10 pt-4">
                    {checkoutUrl && <button type="button" onClick={correctSale} className="text-xs font-black uppercase tracking-[0.14em] text-white/50 hover:text-white">Correct details</button>}
                    <button type="button" onClick={nextSale} className="text-xs font-black uppercase tracking-[0.14em] text-brand-neon hover:underline">Start next sale</button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* A rep's own commission — held, due, paid, and the payout terms — lives
            on the desk they actually work from, not only the admin dashboard. */}
        <div className="mt-8"><RecoveryLeadsBoard /></div>

        <div className="mt-8"><MyEarnings /></div>

        <div className="mt-8"><EngagementBoard /></div>

        <div className="mt-8 grid gap-7 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="font-display text-xl font-black text-white">Leads to work</h2>
              <span className="text-xs text-white/35">Tap Sell to prefill the form</span>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {leads.length === 0 ? (
                <p className="border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/45">No unclaimed leads right now.</p>
              ) : leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{lead.name}</p>
                    <p className="truncate text-xs text-white/40">{[lead.category, lead.address, lead.phone, lead.email].filter(Boolean).join(' / ')}</p>
                  </div>
                  <button type="button" onClick={() => chooseLead(lead)} className="shrink-0 bg-brand-neon px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black hover:bg-cyan-300">Sell</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xl font-black text-white">Recent orders</h2>
            <div className="border border-white/10">
              {closedDeals.length === 0 ? (
                <p className="bg-white/[0.03] px-5 py-6 text-sm text-white/45">No deals yet. The first one will appear here.</p>
              ) : closedDeals.slice(0, 12).map((deal: any) => (
                <div key={deal.id} className="border-b border-white/5 bg-white/[0.03] px-4 py-3 text-sm last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white/85">{deal.name}</p>
                      <p className="truncate text-xs text-white/35">{deal.product_name || 'CityBeat product'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-black text-white">{deal.billing_type === 'free' ? 'Free' : deal.amount ? money(deal.amount) : 'Legacy'}</p>
                      {deal.discount_amount > 0 && <p className="text-[10px] font-bold text-brand-gold">-{money(deal.discount_amount)} discount</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
                    <span className={`border px-2 py-1 ${deal.payment_status === 'paid' ? 'border-brand-neon/30 text-brand-neon' : 'border-white/15 text-white/45'}`}>Payment: {deal.payment_status}</span>
                    {/* The truth about the payment link. Every unpaid order used
                        to read "ready" forever, so a rep believed dead links were
                        live and never followed up. */}
                    {deal.checkout_state === 'expired' && (
                      <span className="border border-amber-400/40 px-2 py-1 font-bold text-amber-300">
                        {isEs ? 'Enlace vencido — dar seguimiento' : 'Link expired — follow up'}
                      </span>
                    )}
                    {deal.checkout_state === 'ready' && (
                      <span className="border border-white/15 px-2 py-1 text-white/45">
                        {isEs ? 'Enlace activo' : 'Link live'}
                      </span>
                    )}
                    {deal.billing_type === 'subscription' && <span className={`border px-2 py-1 ${deal.billing_status === 'past_due' ? 'border-red-400/40 text-red-300' : 'border-white/15 text-white/45'}`}>Billing: {String(deal.billing_status).replace(/_/g, ' ')}</span>}
                    {deal.billing_type !== 'free' && <span className="border border-white/15 px-2 py-1 text-white/45">Brief: {deal.intake_status}{deal.intake_status !== 'submitted' ? ` ${deal.intake_completion || 0}%` : ''}</span>}
                    <span className={`border px-2 py-1 ${deal.fulfillment_status === 'needs_attention' ? 'border-red-400/40 text-red-300' : 'border-white/15 text-white/45'}`}>Fulfillment: {String(deal.fulfillment_status).replace(/_/g, ' ')}</span>
                    {deal.commission_amount > 0 && <span className="border border-brand-magenta/30 px-2 py-1 text-brand-magenta">Commission: {money(deal.commission_amount)}</span>}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mb-3 mt-7 font-display text-xl font-black text-white">Leaderboard</h2>
            <div className="border border-white/10">
              {(me?.leaderboard || []).length === 0 ? (
                <p className="bg-white/[0.03] px-5 py-4 text-sm text-white/45">No paid commissions yet.</p>
              ) : (me?.leaderboard || []).map((row: any, index: number) => (
                <div key={`${row.name}-${index}`} className={`flex items-center justify-between border-b border-white/5 px-4 py-3 text-sm last:border-0 ${row.me ? 'bg-brand-neon/10' : 'bg-white/[0.03]'}`}>
                  <span className="text-white/75"><span className="mr-2 text-white/25">{index + 1}</span>{row.name}{row.me ? ' (you)' : ''}</span>
                  <span className="font-black text-white">{money(row.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </CityBeatShell>
  )
}
