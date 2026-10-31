'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { ApartmentLocale } from '@/lib/apartments'

export default function RegisterCompanyClient({ locale }: { locale: ApartmentLocale }) {
  const es = locale === 'es', t = (en: string, spanish: string) => es ? spanish : en
  const [signedIn, setSignedIn] = useState(false), [request, setRequest] = useState<any>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { const response = await fetch('/api/property-management/register', { cache: 'no-store' }); setSignedIn(response.ok); if (response.ok) setRequest((await response.json()).request) } catch { /* public signup remains available */ }
  }, [])
  useEffect(() => { void load() }, [load])
  const fieldClass = 'mt-2 w-full rounded-lg border border-white/25 bg-brand-ink p-3 text-white'
  return <section id="new-company" className="container-wide mt-12 scroll-mt-24"><div className="rounded-2xl border border-brand-neon/30 bg-brand-ink p-6 sm:p-9">
    <h2 className="text-2xl font-black">{t('Your firm isn’t listed? Start your portfolio.', '¿Su empresa no aparece? Cree su portafolio.')}</h2>
    <p className="mt-3 max-w-3xl leading-7 text-white/65">{t('Residential and commercial management firms can apply here. Once your company authority is approved, add properties, choose listing managers, and enroll your portfolio in one monthly bill.', 'Las administradoras residenciales y comerciales pueden solicitarlo aquí. Después de verificar su autorización, agregue propiedades, asigne responsables e inscriba el portafolio en una sola factura mensual.')}</p>
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-400 p-4">{error}</p>}
    {!signedIn ? <Link href={`/${locale}/login?redirectTo=${encodeURIComponent('/property-management#new-company')}`} className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-brand-neon px-5 font-black text-black">{t('Sign in / Register your company', 'Iniciar sesión / Registrar empresa')}</Link> : request?.status === 'approved' ? <Link href={`/${locale}/property-management/${request.company_id}#portfolio`} className="mt-5 inline-flex min-h-12 items-center font-black text-brand-neon">{t('Open your corporate portfolio', 'Abrir su portafolio corporativo')} →</Link> : request?.status === 'pending' ? <p className="mt-5 font-bold text-brand-neon">{t('Your company application is awaiting authority review. Return here to check its status.', 'Su solicitud de empresa está pendiente de verificación. Regrese aquí para consultar su estado.')}</p> : <form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      const data = new FormData(event.currentTarget)
      try {
        const response = await fetch('/api/property-management/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(data), authorized: data.get('authorized') === 'on' }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.code)
        await load()
      } catch (e) { setError(e instanceof Error && e.message === 'verified_email_required' ? t('Verify your account email and sign in again.', 'Verifique el correo de su cuenta y vuelva a iniciar sesión.') : t('Check your information and any existing company application, then try again.', 'Revise sus datos y cualquier solicitud existente de empresa y vuelva a intentarlo.')) }
      finally { setBusy(false) }
    }}>
      {request?.note && <p className="text-white/65 sm:col-span-2">{request.note}</p>}
      {([['name', t('Company name', 'Nombre de la empresa'), 'text', 160], ['website', t('Official company website', 'Sitio web oficial'), 'url', 500], ['phone', t('Public company phone', 'Teléfono público de la empresa'), 'tel', 30], ['region', t('Service area / cities', 'Área de servicio / ciudades'), 'text', 100], ['role', t('Your corporate role', 'Su cargo corporativo'), 'text', 120]] as const).map(([name, label, type, max]) => <label key={name} className="text-sm font-bold">{label}<input required minLength={2} maxLength={max} name={name} type={type} className={fieldClass}/></label>)}
      <label className="text-sm font-bold sm:col-span-2">{t('Evidence of your authority and company contact for verification', 'Evidencia de su autorización y contacto de la empresa para verificarla')}<textarea required name="evidence" minLength={20} maxLength={3000} rows={3} className={fieldClass}/></label>
      <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input required name="authorized" type="checkbox" className="mt-1 h-5 w-5 shrink-0"/>{t('I am authorized to represent this property management firm. This application is free and does not start a paid subscription.', 'Estoy autorizado para representar a esta administradora. Esta solicitud es gratuita y no inicia una suscripción de pago.')}</label>
      <button disabled={busy} className="min-h-12 justify-self-start rounded-lg bg-brand-neon px-5 font-black text-black disabled:opacity-40">{t('Request company verification', 'Solicitar verificación de empresa')}</button>
    </form>}
  </div></section>
}
