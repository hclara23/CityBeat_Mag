'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { promotionDaysLeft } from '@/lib/premier-promotion'

type Offer = { name: string; until: string; open: boolean; paid: boolean; owned: boolean; locations: number }
export function PremierPromotion({ locale }: { locale: string }) {
  const es = locale === 'es'
  const [offer, setOffer] = useState<Offer | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [now, setNow] = useState(Date.now())
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(tick) }, [])
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const returned = new URLSearchParams(window.location.search).get('premier_checkout') === 'success'
    const load = async (attempt = 0) => {
      try {
        const res = await fetch('/api/directory/promotion', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (stopped) return
        const next = data.offer as Offer | null
        setOffer(next)
        if (returned && next && !next.paid && attempt < 8) {
          setConfirming(true)
          timer = setTimeout(() => load(attempt + 1), 3000)
          return
        }
        setConfirming(false)
        if (returned && next && !next.paid) setError(es ? 'El pago aún se está confirmando. No vuelvas a pagar; actualiza el panel en un momento.' : 'Payment is still being confirmed. Do not pay again; refresh your dashboard shortly.')
        if (next?.open && !next.paid && !returned) {
          let dismissed = false
          try { dismissed = sessionStorage.getItem(`premier-offer:${next.until}`) === 'dismissed' } catch {}
          if (!dismissed) setOpen(true)
        }
      } catch { /* The rest of the dashboard stays available on network failure. */ }
    }
    void load()
    return () => { stopped = true; clearTimeout(timer) }
  }, [es])
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const dismiss = () => {
    setOpen(false)
    try { sessionStorage.setItem(`premier-offer:${offer?.until}`, 'dismissed') } catch {}
  }
  const act = async (action: 'claim' | 'checkout') => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/directory/promotion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, locale }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not continue')
      if (typeof data.url !== 'string') throw new Error('Checkout unavailable')
      // Only an internal dashboard path or Stripe's hosted checkout can be opened.
      if (data.url.startsWith('/') && !data.url.startsWith('//')) window.location.assign(data.url)
      else if (new URL(data.url).origin === 'https://checkout.stripe.com') window.location.assign(data.url)
      else throw new Error('Unexpected checkout destination')
    } catch (e: any) { setError(e.message); setBusy(false) }
  }
  if (!offer) return null
  const date = new Date(offer.until).toLocaleString(es ? 'es-MX' : 'en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Denver' })
  const daysLeft = promotionDaysLeft(offer.until, now)
  const stillOpen = offer.open && Date.parse(offer.until) > now
  if (offer.paid) return <section className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900" role="status">
    <h2 className="font-bold">{es ? 'Premier Clinic: Premium activo' : 'Premier Clinic: Premium is active'}</h2>
    <p>{es ? 'Tu suscripción está confirmada. Puedes administrar tu ficha desde este panel.' : 'Your subscription is confirmed. You can manage your listing from this dashboard.'}</p>
    <Link className="underline font-bold" href={`/${locale}/dashboard/listings/premier-clinic`}>{es ? 'Administrar ficha' : 'Manage listing'}</Link>
  </section>
  return <>
    <section className="mb-6 rounded-xl border border-cyan-300 bg-cyan-50 p-5 text-gray-900">
      <h2 className="font-bold">Premier Clinic · {stillOpen ? (es ? `Quedan ${daysLeft} días de Premium gratis` : `${daysLeft} days left in your complimentary Premium listing`) : (es ? 'Tu ficha ahora es Básica' : 'Your listing is now Basic')}</h2>
      <p className="text-sm mt-1">{stillOpen ? (es ? `Premium gratis hasta ${date} (hora de El Paso).` : `Complimentary Premium until ${date} (El Paso time).`) : (es ? 'El periodo gratuito terminó. Tu ficha Básica y tu insignia de portada permanecen.' : 'The free period has ended. Your Basic listing and cover badge remain.')}</p>
      {confirming ? <p role="status">{es ? 'Confirmando el pago…' : 'Confirming payment…'}</p> : stillOpen && <button className="mt-3 font-bold underline" onClick={() => setOpen(true)}>{es ? 'Conservar Premium: $9.99/mes →' : 'Keep Premium: $9.99/month →'}</button>}
      {!offer.owned && <button disabled={busy} onClick={() => act('claim')} className="block mt-3 text-sm underline">{es ? 'Aceptar la invitación y administrar mi ficha gratis' : 'Accept invitation and manage my listing for free'}</button>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </section>
    <dialog ref={dialog} onCancel={dismiss} aria-labelledby="premier-promo-title" className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-cyan-300 bg-white p-7 text-gray-900 shadow-2xl backdrop:bg-black/70">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-700">CityBeat · Premier Clinic</p>
      <h2 id="premier-promo-title" className="mt-3 text-3xl font-black">{es ? 'Conserva tu lugar Premium' : 'Keep your Premium presence'}</h2>
      <p className="mt-4">{es ? 'Tu promoción incluye 30 días gratis de Premium.' : 'Your promotion includes 30 free days of Premium.'}</p>
      <p className="mt-2 text-sm font-semibold">{es ? 'Termina:' : 'Ends:'} {date} · {es ? 'hora de El Paso' : 'El Paso time'}</p>
      <p className="my-5 text-3xl font-black text-cyan-700">$9.99<span className="text-base font-semibold">/{es ? 'mes' : 'month'}</span></p>
      <p className="font-semibold">{es ? 'Precio total Founders para tus tres ubicaciones.' : 'Founders total price for all three locations.'}</p>
      <p className="mt-3 text-sm text-gray-600">{es ? 'Sin una suscripción de pago, la ficha vuelve automáticamente a Básica al terminar la promoción. Conservas el control de tu negocio y la insignia de portada.' : 'Without a paid subscription, the listing automatically returns to Basic when the promotion ends. You keep business control and the cover badge.'}</p>
      <p className="mt-4 text-xs text-gray-600">{es ? 'Si te suscribes ahora: $9.99 hoy y cada mes hasta cancelar. Cancela desde Facturación. No se cobra por cerrar este aviso. Al continuar aceptas administrar esta ficha mediante la invitación de CityBeat.' : 'If you subscribe now: $9.99 today and each month until canceled. Cancel from Billing. Closing this notice never charges you. By continuing, you accept CityBeat’s invitation to manage this listing.'}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} onClick={() => act('checkout')} className="mt-5 w-full rounded-lg bg-cyan-700 py-3 font-bold text-white hover:bg-cyan-800 disabled:opacity-50">{busy ? (es ? 'Abriendo…' : 'Opening…') : (es ? 'Conservar Premium · $9.99/mes →' : 'Keep Premium · $9.99/month →')}</button>
      <button disabled={busy} onClick={dismiss} className="mt-3 w-full py-2 text-sm underline">{es ? 'Ahora no' : 'Not now'}</button>
    </dialog>
  </>
}
