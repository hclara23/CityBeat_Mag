'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'
import { DIRECTORY_PLANS } from '@/lib/pricing'

type Business = { id: string; name: string; address?: string; category?: string; description?: string; image_url?: string;
  claim_status?: string; claim_contact_email_hint?: string; location_count?: number; founders_offer_until?: string }
type Owned = Business & { is_owner: boolean; has_subscription: boolean }
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const daysEs = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const inputClass = 'w-full rounded-xl border border-white/20 bg-brand-ink p-3 text-white focus:border-brand-neon focus:ring-brand-neon'
const primary = 'inline-flex items-center justify-center rounded-xl bg-brand-neon px-5 py-3 font-bold text-black hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed'
const secondary = 'inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 font-semibold hover:border-brand-neon disabled:opacity-50'

async function api(url: string, body?: unknown) {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error || 'Please try again.'), { data })
  return data
}

export default function FoundersFunnel() {
  const locale = useLocale(), es = locale === 'es'
  const t = (en: string, spanish: string) => es ? spanish : en
  const router = useRouter(), params = useSearchParams()
  const selectedId = params.get('listing') || ''
  const creating = params.get('create') === '1'
  const [profile, setProfile] = useState<any>(undefined)
  const [mine, setMine] = useState<Owned[]>([])
  const [available, setAvailable] = useState<boolean | null>(null)
  const [availabilityError, setAvailabilityError] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Business[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [selected, setSelected] = useState<Business | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', category: 'Professional Services', phone: '', website: '', description: '', image_url: '', addresses: [''], hours: {} as Record<string, string>, attested: false })

  async function refresh() {
    const p = await api('/api/profile')
    setProfile(p.profile)
    setMine(p.profile ? (await api('/api/directory/mine')).listings : [])
  }
  useEffect(() => { refresh().catch(() => setError(t('Could not load your account. Please refresh.', 'No se pudo cargar tu cuenta. Actualiza la página.')))
    api('/api/founders').then(d => { setAvailable(d.available); setAvailabilityError(Boolean(d.error)) }).catch(() => { setAvailabilityError(true); setAvailable(false) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true
    setSelected(null); setPending(false); setCodeSent(false); setCode(''); setError('')
    if (selectedId) api(`/api/directory/${encodeURIComponent(selectedId)}`).then(d => { if (active) setSelected(d.listing) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [selectedId])
  const own = mine.find(x => x.id === selectedId && x.is_owner)
  const approved = own?.claim_status === 'approved'
  const awaiting = pending || own?.claim_status === 'pending_approval'
  const returnTo = creating ? '/founders?create=1' : `/founders${selectedId ? `?listing=${encodeURIComponent(selectedId)}` : ''}`
  const login = `/${locale}/login?redirectTo=${encodeURIComponent(returnTo)}`
  const price = (DIRECTORY_PLANS.founding.unitAmount / 100).toFixed(2)
  const count = Math.max(1, selected?.location_count || form.addresses.length)

  function select(id: string) { router.push(`/${locale}/founders?listing=${encodeURIComponent(id)}`) }
  async function search(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setResults(null)
    try { const d = await api(`/api/directory?query=${encodeURIComponent(query.trim())}`); setResults(d.listings); setTruncated(Boolean(d.truncated)) }
    catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  async function action(run: () => Promise<void>) {
    setBusy(true); setError('')
    try { await run() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  async function create() {
    await action(async () => {
      try { const d = await api('/api/founders', form); await refresh(); select(d.listingId) }
      catch (e: any) { if (e.data?.listingId) { select(e.data.listingId); return } throw e }
    })
  }
  function field(key: 'name' | 'phone' | 'website' | 'image_url', label: string, type = 'text', required = false) {
    return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><input className={inputClass} value={form[key]} type={type} required={required} maxLength={300} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>
  }
  const signIn = <div className="space-y-4"><h3 className="text-xl font-bold">{t('Keep your business connected to you.', 'Tu negocio, bajo tu control.')}</h3><p className="text-white/65">{t('Continue to sign in with Google. Signing in is free and does not subscribe you or prove business ownership.', 'Continúa para iniciar sesión con Google. Es gratis; no activa una suscripción ni verifica la propiedad del negocio.')}</p><Link className={primary} href={login}>{t('Continue to Google sign-in', 'Continuar a iniciar sesión con Google')}</Link></div>

  return <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
    <section className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <div><p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-brand-neon">{t('CityBeat · Founding 100', 'CityBeat · Primeros 100')}</p>
        <h1 className="font-display text-4xl font-black leading-tight sm:text-6xl">{t('Your business belongs in the spotlight.', 'Tu negocio merece destacar.')}</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/65">{t('Find your business. Make it yours. Give customers a better way to discover what you do.', 'Encuentra tu negocio. Reclámalo. Ayuda a tus clientes a descubrir lo que haces.')}</p>
        <ul className="mt-7 space-y-3 text-white/85">{[t('Photo gallery and a custom cover', 'Galería de fotos y portada personalizada'), t('Social, booking and website links', 'Enlaces de redes, reservas y sitio web'), t('Business updates, offers and lead insights', 'Novedades, ofertas y estadísticas de contactos')].map(s => <li key={s}><span className="mr-3 text-brand-neon">✓</span>{s}</li>)}</ul>
      </div>
      <aside className="rounded-3xl border border-brand-neon/40 bg-brand-charcoal p-7 sm:p-9">
        <p className="font-bold text-brand-neon">{t('Premium, at a Founders price', 'Premium a precio de Fundador')}</p>
        <p className="mt-4"><span className="text-6xl font-black">${price}</span><span className="ml-2 text-white/65">{t('/ month', '/ mes')}</span></p>
        <p className="mt-3 text-sm text-white/65">{t('Per business. All your locations included. After the first 100 businesses, new signups pay the regular $19.99/month per location.', 'Por negocio. Incluye todas tus ubicaciones. Después de los primeros 100 negocios, las nuevas inscripciones pagan $19.99/mes por ubicación.')}</p>
        <p className="mt-5 font-semibold">{t('Limited to the first 100 businesses.', 'Limitado a los primeros 100 negocios.')}</p>
        <p className="mt-3 text-sm leading-relaxed text-white/65">{t('Your rate stays locked while your subscription remains active. Renews monthly until canceled in Billing. No payment required to search or request a free Basic listing.', 'Tu tarifa se mantiene mientras tu suscripción siga activa. Se renueva mensualmente hasta cancelar en Facturación. Buscar o solicitar una ficha Básica es gratis.')}</p>
        <a href="#get-started" className={`${primary} mt-6 w-full`}>{t('Find my business', 'Buscar mi negocio')}</a>
        <p className="mt-4 text-xs text-white/60" aria-live="polite">{available === null ? t('Checking availability…', 'Consultando disponibilidad…') : available ? t('Availability is confirmed at checkout. Searching does not reserve a spot.', 'La disponibilidad se confirma al pagar. Buscar no reserva un lugar.') : availabilityError ? t('We cannot confirm availability right now. You can still create a free Basic listing.', 'No podemos confirmar disponibilidad. Puedes crear una ficha Básica gratis.') : t('Founders spots are currently filled or reserved. Basic is still free.', 'Los lugares están ocupados o reservados. Básico sigue siendo gratis.')}</p>
      </aside>
    </section>

    <section id="get-started" className="mt-14 scroll-mt-8 rounded-3xl border border-white/10 bg-brand-charcoal p-5 sm:p-8">
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-wider text-white/50"><li>01 · {t('Find or create', 'Busca o crea')}</li><li>02 · {t('Verify ownership', 'Verifica propiedad')}</li><li>03 · {t('Choose your upgrade', 'Elige tu mejora')}</li></ol>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-red-200">{error}</p>}
      {params.get('checkout') === 'cancelled' && <p className="mb-5 text-white/75">{t('Checkout canceled. Your Basic listing remains available; you can return when ready.', 'Pago cancelado. Tu ficha Básica sigue disponible; regresa cuando quieras.')}</p>}
      {!selectedId && !creating && <div className="space-y-6">
        <h2 className="text-2xl font-bold">{t('Is your business already here?', '¿Tu negocio ya está aquí?')}</h2>
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row"><label className="flex-1"><span className="sr-only">{t('Business name or address', 'Nombre o dirección del negocio')}</span><input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Business name or street address', 'Nombre del negocio o dirección')} minLength={2} maxLength={100} required /></label><button className={primary} disabled={busy || query.trim().length < 2}>{busy ? t('Searching…', 'Buscando…') : t('Search businesses', 'Buscar negocios')}</button></form>
        {mine.length > 0 && <div><h3 className="mb-3 font-semibold">{t('Your listings', 'Tus fichas')}</h3><div className="flex flex-wrap gap-3">{mine.filter(b => b.is_owner).map(b => <button key={b.id} className={secondary} onClick={() => select(b.id)}>{b.name}</button>)}</div></div>}
        {results !== null && <div aria-live="polite" className="space-y-4"><p className="text-sm text-white/65">{results.length ? t('Select your business below. Check the address to avoid claiming the wrong location.', 'Selecciona tu negocio. Verifica la dirección antes de reclamarlo.') : t('No matches found. Try another spelling or create your listing below.', 'No encontramos coincidencias. Prueba otra forma de escribirlo o crea tu ficha.')}</p>
          {truncated && <p>{t('Many matches. Narrow your search using the street address.', 'Hay muchas coincidencias. Busca por dirección.')}</p>}
          <div className="max-h-[28rem] space-y-3 overflow-y-auto">{results.map(b => <button className="w-full rounded-xl border border-white/15 p-4 text-left hover:border-brand-neon" key={b.id} onClick={() => select(b.id)}><span className="block font-bold">{b.name}</span><span className="mt-1 block text-sm text-white/60">{b.address || b.category}</span><span className="mt-2 block text-xs text-brand-neon">{t('Select this business →', 'Seleccionar este negocio →')}</span></button>)}</div>
          <Link className={secondary} href={`/${locale}/founders?create=1`}>{t('My business is not here — create a listing', 'Mi negocio no está — crear una ficha')}</Link>
        </div>}
      </div>}

      {creating && !selectedId && <div className="space-y-5">
        <Link className="text-sm text-brand-neon" href={`/${locale}/founders`}>← {t('Back to search', 'Volver a buscar')}</Link>
        {profile === undefined ? <p>{t('Loading account…', 'Cargando cuenta…')}</p> : !profile ? signIn : <>
          <h2 className="text-2xl font-bold">{[t('Tell us about your business', 'Cuéntanos de tu negocio'), t('Locations and hours', 'Ubicaciones y horarios'), t('Preview and submit', 'Revisa y envía')][step]}</h2>
          <p className="text-sm text-white/60">{t(`Step ${step + 1} of 3 · Free to submit. Staff review required before publication.`, `Paso ${step + 1} de 3 · Envío gratis. Revisión requerida antes de publicar.`)}</p>
          <form onSubmit={e => { e.preventDefault(); step < 2 ? setStep(step + 1) : create() }} className="space-y-5">
            {step === 0 && <div className="grid gap-5 sm:grid-cols-2">{field('name', t('Business name', 'Nombre del negocio'), 'text', true)}
              <label className="space-y-2"><span>{t('Category', 'Categoría')}</span><select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Restaurant', 'Retail', 'Home Services', 'Health', 'Beauty', 'Fitness', 'Auto Repair', 'Real Estate', 'Professional Services', 'Entertainment'].map(x => <option key={x}>{x}</option>)}</select></label>
              {field('phone', t('Business phone', 'Teléfono del negocio'), 'tel', true)}{field('website', t('Website (optional)', 'Sitio web (opcional)'), 'url')}
              <label className="space-y-2 sm:col-span-2"><span>{t('Short description', 'Descripción breve')}</span><textarea className={inputClass} maxLength={500} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
              <div className="sm:col-span-2">{field('image_url', t('Main photo URL (optional)', 'URL de foto principal (opcional)'), 'url')}<p className="mt-2 text-xs text-white/50">{t('Use a public image you have permission to publish. You can upload photos from your dashboard after approval.', 'Usa una imagen pública que tengas permiso de publicar. Puedes subir fotos desde tu panel después de aprobación.')}</p></div>
            </div>}
            {step === 1 && <div className="space-y-5">{form.addresses.map((address, i) => <div key={i} className="flex items-end gap-2"><label className="flex-1 space-y-2"><span>{t(`Location ${i + 1}: full street address, city, state and ZIP`, `Ubicación ${i + 1}: dirección completa, ciudad, estado y código postal`)}</span><input className={inputClass} value={address} minLength={8} maxLength={300} required onChange={e => setForm({ ...form, addresses: form.addresses.map((a, j) => j === i ? e.target.value : a) })} /></label>{i > 0 && <button type="button" className={secondary} aria-label={t('Remove location', 'Quitar ubicación')} onClick={() => setForm({ ...form, addresses: form.addresses.filter((_, j) => j !== i) })}>×</button>}</div>)}
              {form.addresses.length < 10 && <button type="button" className={secondary} onClick={() => setForm({ ...form, addresses: [...form.addresses, ''] })}>{t('+ Add another location', '+ Agregar otra ubicación')}</button>}
              <p className="text-sm text-brand-neon">{t('Optional Founders upgrade:', 'Mejora opcional de Fundadores:')} ${price}{t('/month total, including', '/mes en total, incluyendo')} {form.addresses.length} {t('location(s). No payment now.', 'ubicación(es). Sin pago ahora.')}</p>
              <p className="text-sm text-white/60">{t('Primary location hours (optional). Use “Closed” or “By appointment” where appropriate.', 'Horario de ubicación principal (opcional). Usa “Cerrado” o “Con cita” según corresponda.')}</p>
              <div className="grid gap-3 sm:grid-cols-2">{days.map((day, i) => <label key={day} className="space-y-1"><span className="text-sm">{es ? daysEs[i] : day}</span><input className={inputClass} value={form.hours[day] || ''} maxLength={80} placeholder="9:00 AM – 5:00 PM" onChange={e => setForm({ ...form, hours: { ...form.hours, [day]: e.target.value } })} /></label>)}</div>
            </div>}
            {step === 2 && <><article className="rounded-2xl border border-white/15 bg-brand-dark p-6"><p className="text-xs uppercase tracking-widest text-brand-neon">{form.category}</p><h3 className="mt-3 text-3xl font-bold">{form.name}</h3><p className="mt-3 text-white/75">{form.description}</p><div className="mt-4 space-y-2 text-sm text-white/65">{form.addresses.map(a => <p key={a}>{a}</p>)}<p>{form.phone}</p><p className="break-all">{form.website}</p></div></article>
              <p>{t('Submitting creates a free Basic listing pending review. No card required. After approval, you may choose Founders if a spot is available.', 'El envío crea una ficha Básica gratis pendiente de revisión. No requiere tarjeta. Después de aprobarse, puedes elegir Fundadores si hay disponibilidad.')}</p>
              <label className="flex items-start gap-3"><input type="checkbox" required checked={form.attested} onChange={e => setForm({ ...form, attested: e.target.checked })} /><span className="text-sm">{t('I am authorized to represent this business and have permission to publish the submitted content.', 'Estoy autorizado para representar este negocio y publicar el contenido enviado.')}</span></label></>}
            <div className="flex flex-wrap gap-3">{step > 0 && <button type="button" className={secondary} onClick={() => setStep(step - 1)}>{t('Back', 'Atrás')}</button>}<button className={primary} disabled={busy}>{busy ? t('Saving…', 'Guardando…') : step < 2 ? t('Continue', 'Continuar') : t('Submit free listing for review', 'Enviar ficha gratis a revisión')}</button></div>
          </form>
        </>}
      </div>}

      {selectedId && <div className="space-y-5"><Link className="text-sm text-brand-neon" href={`/${locale}/founders`}>← {t('Choose another business', 'Elegir otro negocio')}</Link>
        {!selected ? <p>{t('Loading business…', 'Cargando negocio…')}</p> : <><h2 className="text-3xl font-bold">{selected.name}</h2><p className="text-white/60">{selected.address}</p>
          {profile === undefined ? <p>{t('Loading account…', 'Cargando cuenta…')}</p> : !profile ? signIn : awaiting ? <div className="space-y-4"><h3 className="text-xl font-bold text-brand-neon">{t('Your request is under review', 'Tu solicitud está en revisión')}</h3><p>{t('Our team will verify your ownership before you can manage or pay for this listing. Approval notifications go to your account. No Founders spot is reserved yet.', 'Nuestro equipo verificará la propiedad antes de que puedas administrar o pagar. Las notificaciones llegan a tu cuenta. Aún no se reserva un lugar.')}</p><button className={secondary} disabled={busy} onClick={() => action(async () => { await refresh(); setPending(false) })}>{t('Check approval status', 'Consultar aprobación')}</button><p className="text-sm text-white/60">{t('Questions? Email hello@citybeatmag.co.', '¿Preguntas? Escribe a hello@citybeatmag.co.')}</p></div>
          : approved ? <div className="space-y-5"><p className="text-brand-neon">{t('Ownership approved. Your Basic listing is yours to manage.', 'Propiedad aprobada. Puedes administrar tu ficha Básica.')}</p>
            {selected.founders_offer_until ? <Link className={primary} href={`/${locale}/dashboard`}>{t('Open your private promotion in the dashboard', 'Ver tu promoción privada en el panel')}</Link> : own?.has_subscription ? <Link className={primary} href={`/${locale}/billing`}>{t('Manage existing subscription', 'Administrar suscripción actual')}</Link> : <>
              <p className="text-xl font-bold">${price}{t('/month total', '/mes en total')} · {count} {t('location(s) included', 'ubicación(es) incluidas')}</p>
              <p className="text-sm text-white/65">{t('First payment at checkout. Renews monthly until canceled in Billing. Your rate stays locked while subscribed. Payment activates Premium only after confirmation.', 'Primer pago al finalizar. Se renueva mensualmente hasta cancelar en Facturación. La tarifa se mantiene mientras estés suscrito. Premium se activa al confirmar el pago.')}</p>
              <button className={primary} disabled={busy || available !== true} onClick={() => action(async () => { const d = await api('/api/directory/claim', { listingId: selectedId, plan: 'founding', source: 'founders', locale }); window.location.assign(d.url) })}>{busy ? t('Opening secure checkout…', 'Abriendo pago seguro…') : t('Get Founders Premium — continue to payment', 'Obtener Premium — continuar al pago')}</button>
              {available === false && <div className="space-y-3"><p>{t('Founders is currently unavailable. Keep Basic for free, check back later, or choose regular Premium below.', 'Fundadores no está disponible ahora. Conserva Básico gratis, vuelve después o elige Premium regular abajo.')}</p>
                <button className={secondary} disabled={busy} onClick={() => action(async () => { const d = await api('/api/directory/claim', { listingId: selectedId, plan: 'premium_monthly', source: 'founders', locale }); window.location.assign(d.url) })}>{t('Regular Premium:', 'Premium regular:')} ${(count * DIRECTORY_PLANS.premium_monthly.unitAmount / 100).toFixed(2)}{t('/month total — $19.99 per location', '/mes total — $19.99 por ubicación')}</button>
              </div>}
            </>}
            <div><Link className={secondary} href={`/${locale}/dashboard/listings/${encodeURIComponent(selectedId)}`}>{t('Keep Basic / manage my listing', 'Mantener Básico / administrar ficha')}</Link></div>
          </div> : selected.claim_status && selected.claim_status !== 'unclaimed' ? <p>{t('This listing is already claimed or under review. Sign in with the owner account, or contact hello@citybeatmag.co for help. Do not create a duplicate.', 'Esta ficha ya está reclamada o en revisión. Inicia sesión con la cuenta propietaria o contacta hello@citybeatmag.co. No crees un duplicado.')}</p> : <div className="space-y-4"><h3 className="text-xl font-bold">{t('Verify your connection to this business', 'Verifica tu relación con este negocio')}</h3>
            {selected.claim_contact_email_hint ? <><p className="text-white/65">{t('We send a verification code to the business email already on file:', 'Enviamos un código al correo del negocio registrado:')} {selected.claim_contact_email_hint}</p>
              {!codeSent ? <button className={primary} disabled={busy} onClick={() => action(async () => { await api(`/api/directory/${encodeURIComponent(selectedId)}/claim/start`, { method: 'email' }); setCodeSent(true) })}>{t('Send verification code', 'Enviar código de verificación')}</button> : <form className="flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); action(async () => { await api(`/api/directory/${encodeURIComponent(selectedId)}/claim/verify`, { code }); setPending(true); await refresh() }) }}><label><span className="sr-only">{t('Verification code', 'Código de verificación')}</span><input className={inputClass} value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="123456" /></label><button className={primary} disabled={busy}>{t('Verify and request approval', 'Verificar y solicitar aprobación')}</button></form>}
            </> : <p>{t('This listing has no verification email on file. Contact hello@citybeatmag.co with the business name and proof that you represent it. Our team can help verify ownership; you do not need to pay or create a duplicate.', 'Esta ficha no tiene correo de verificación. Contacta hello@citybeatmag.co con el nombre y prueba de representación. Te ayudamos a verificar; no necesitas pagar ni crear un duplicado.')}</p>}
            <p className="text-sm text-white/50">{t('Verification and Basic management are free. Paying never bypasses ownership review.', 'La verificación y administración Básica son gratis. Pagar no omite la revisión.')}</p>
          </div>}
        </>}
      </div>}
    </section>
    <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-white/50">{t('No pressure to upgrade. Verified owners can keep a regular Basic listing for free. Creating an account, searching, and submitting a claim do not authorize a charge.', 'Sin obligación de mejorar. Los propietarios verificados pueden mantener una ficha Básica gratis. Crear una cuenta, buscar y solicitar una ficha no autoriza ningún cobro.')}</p>
  </div>
}
