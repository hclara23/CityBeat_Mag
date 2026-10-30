'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import type { ApartmentCommunity, ApartmentLocale } from '@/lib/apartments'
import { CLAIM_SMS_CONSENT, CLAIM_SMS_CONSENT_VERSION } from '@/lib/claim-sms-consent'

type ClaimState = { claimable: boolean; phoneHint: string | null; status: string }

const errorMessages: Record<string, { en: string; es: string }> = {
  unauthorized: { en: 'Please sign in again to claim this property.', es: 'Inicia sesión de nuevo para reclamar esta propiedad.' },
  not_found: { en: 'This property could not be found.', es: 'No encontramos esta propiedad.' },
  unavailable: { en: 'Text verification is unavailable. Contact CityBeat for a review of your authorization.', es: 'La verificación por texto no está disponible. Contacta a CityBeat para revisar tu autorización.' },
  already_claimed: { en: 'This property already has a manager or a claim under review. Contact CityBeat if you need help.', es: 'Esta propiedad ya tiene un administrador o un reclamo en revisión. Contacta a CityBeat si necesitas ayuda.' },
  consent_required: { en: 'Please check the SMS consent box before requesting a code.', es: 'Marca la casilla de consentimiento SMS antes de solicitar un código.' },
  rate_limited: { en: 'Too many requests. Please try again later or contact CityBeat.', es: 'Demasiadas solicitudes. Inténtalo más tarde o contacta a CityBeat.' },
  send_failed: { en: 'The text could not be sent. This leasing number may not receive texts. Contact CityBeat for another way to verify.', es: 'No se pudo enviar el texto. Es posible que este número de arrendamiento no reciba textos. Contacta a CityBeat para verificar de otra manera.' },
  no_active_claim: { en: 'No active code was found. Request a new verification code.', es: 'No encontramos un código activo. Solicita un nuevo código de verificación.' },
  expired: { en: 'This code has expired. Request a new verification code.', es: 'Este código venció. Solicita un nuevo código de verificación.' },
  too_many_attempts: { en: 'Too many incorrect attempts. Request a new code.', es: 'Demasiados intentos incorrectos. Solicita un nuevo código.' },
  invalid_code: { en: 'The verification code is incorrect. Check the text and try again.', es: 'El código de verificación es incorrecto. Revisa el texto e inténtalo de nuevo.' },
  conflict: { en: 'This claim is no longer available. Contact CityBeat for help.', es: 'Este reclamo ya no está disponible. Contacta a CityBeat para recibir ayuda.' },
  internal_error: { en: 'Something went wrong. Please try again or contact CityBeat.', es: 'Ocurrió un error. Inténtalo de nuevo o contacta a CityBeat.' },
}

export default function ApartmentClaimClient({ community, locale }: { community: ApartmentCommunity; locale: ApartmentLocale }) {
  const es = locale === 'es'
  const [claim, setClaim] = useState<ClaimState | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'request' | 'verify' | 'complete'>('request')
  const [approved, setApproved] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [error, setError] = useState('')
  const api = `/api/apartments/${community.slug}/claim`
  const detailPath = `/${locale}/apartments/${community.slug}`
  const errorText = (value: unknown) => (errorMessages[String(value)] || errorMessages.internal_error)[locale]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setConsent(false)
    setError('')
    setStep('request')
    setApproved(false)
    setCode('')
    async function load() {
      try {
        const [claimResponse, profileResponse] = await Promise.all([
          fetch(api, { signal: controller.signal, cache: 'no-store' }),
          fetch('/api/profile', { signal: controller.signal, cache: 'no-store' }),
        ])
        const data = await claimResponse.json()
        if (!claimResponse.ok) throw new Error(data.errorCode || 'internal_error')
        setClaim(data)
        setSignedIn(profileResponse.ok && Boolean((await profileResponse.json()).profile?.id))
      } catch (cause) {
        if (!controller.signal.aborted) setError((errorMessages[cause instanceof Error ? cause.message : 'internal_error'] || errorMessages.internal_error)[locale])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [api, locale])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !signedIn || !claim?.claimable || (step === 'request' && !consent)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${api}/${step === 'request' ? 'start' : 'verify'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(step === 'request'
          ? { smsConsent: consent, smsConsentVersion: CLAIM_SMS_CONSENT_VERSION, locale }
          : { code, locale }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(errorText(data.errorCode))
        if (data.errorCode === 'unauthorized') setSignedIn(false)
        if (['already_claimed', 'conflict'].includes(data.errorCode)) setClaim({ ...claim, claimable: false, status: 'pending_approval' })
        return
      }
      if (step === 'request') {
        setRecipient(data.recipient || claim.phoneHint || '')
        setCode('')
        setStep('verify')
      } else {
        setApproved(data.status === 'approved')
        setStep('complete')
        setConsent(false)
      }
    } catch {
      setError(errorText('internal_error'))
    } finally {
      setBusy(false)
    }
  }

  return <CityBeatShell locale={locale}>
    <div className="citybeat-app container-wide py-8 sm:py-12">
      <Link href={detailPath} className="inline-flex min-h-11 items-center text-sm font-bold text-brand-neon">← {es ? 'Volver a la propiedad' : 'Back to property'}</Link>
      <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-white/15 bg-brand-ink p-6 sm:p-10">
        <p className="text-xs font-black uppercase tracking-wider text-brand-neon">{es ? 'Para administradores autorizados' : 'For authorized property managers'}</p>
        <h1 className="mt-3 font-display text-3xl font-black">{es ? 'Reclamar esta propiedad' : 'Claim this property'}</h1>
        <h2 className="mt-3 text-xl font-bold">{community.name}</h2>
        <p className="mt-2 text-sm text-white/65">{community.address}, El Paso, TX {community.zip}</p>
        <p className="mt-5 text-sm leading-6 text-white/80">{es ? 'Verifica gratis que tienes acceso al teléfono registrado de esta propiedad. Nuestro equipo revisará tu autorización para administrar la ficha antes de aprobar el reclamo.' : 'Verify access to this property’s recorded phone for free. Our team will review your authorization to manage the listing before approving the claim.'}</p>
        {loading ? <p role="status" className="mt-6">{es ? 'Cargando verificación…' : 'Loading verification…'}</p> : <>
          {error && <p role="alert" className="mt-6 rounded-lg border border-brand-magenta/50 bg-brand-magenta/10 p-4 text-sm text-white">{error}</p>}
          {step === 'complete' ? <div role="status" className="mt-6 rounded-xl border border-brand-neon/40 p-5">
            <h3 className="text-lg font-bold text-brand-neon">{approved ? (es ? 'Propiedad vinculada a tu cuenta' : 'Property linked to your account') : (es ? 'Teléfono verificado' : 'Phone verified')}</h3>
            <p className="mt-2 text-sm leading-6">{approved ? (es ? 'Esta ficha ya estaba aprobada y ahora está vinculada a tu cuenta. Abre tu panel para administrarla.' : 'This listing was already approved and is now linked to your account. Open your dashboard to manage it.') : (es ? 'Tu reclamo está pendiente de revisión. Verificar el teléfono no otorga acceso de administración automáticamente. Te notificaremos cuando nuestro equipo tome una decisión.' : 'Your claim is pending review. Phone verification does not automatically grant management access. We will notify you when our team makes a decision.')}</p>
            {approved && <Link href={`/${locale}/dashboard`} className="mt-4 inline-flex min-h-11 items-center font-bold text-brand-neon underline">{es ? 'Abrir mi panel' : 'Open my dashboard'}</Link>}
            <Link href={detailPath} className="mt-4 inline-flex min-h-11 items-center font-bold text-brand-neon underline">{es ? 'Volver a la propiedad' : 'Back to property'}</Link>
          </div> : claim && !claim.claimable ? <p role="status" className="mt-6 rounded-lg border border-white/20 p-4 text-sm leading-6">{claim.status === 'approved' ? (es ? 'Esta propiedad ya tiene un administrador. Contacta a CityBeat si necesitas cambiar la persona autorizada.' : 'This property already has a manager. Contact CityBeat if the authorized manager needs to change.') : errorText('already_claimed')}</p> : claim && <>
            <p className="mt-6 text-sm leading-6">{es ? 'El código se envía únicamente al número registrado que termina en' : 'The code goes only to the recorded number ending in'} <strong>{claim.phoneHint}</strong>. {es ? 'No puedes sustituirlo por otro número en este formulario.' : 'You cannot substitute another number in this form.'}</p>
            {!signedIn ? <div className="mt-6 space-y-4">
              <p className="text-sm leading-6">{es ? 'Inicia sesión o crea una cuenta, marca la casilla de consentimiento SMS y solicita un código. Este es el consentimiento que se te pedirá:' : 'Sign in or create an account, check the SMS consent box, and request a code. You will be asked to agree to this disclosure:'}</p>
              <p className="rounded-lg border border-white/15 p-4 text-sm leading-6 text-white/75">{CLAIM_SMS_CONSENT[locale]}</p>
              <Link href={`/${locale}/login?redirectTo=${encodeURIComponent(`/apartments/${community.slug}/claim`)}`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-neon px-5 font-bold text-black">{es ? 'Iniciar sesión / Registrarse' : 'Sign in / Register'}</Link>
            </div> : <form onSubmit={submit} className="mt-6 space-y-5">
              {step === 'request' ? <label className="flex items-start gap-3 rounded-lg border border-white/20 p-4 text-sm leading-6">
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-neon" />
                <span>{CLAIM_SMS_CONSENT[locale]}</span>
              </label> : <>
                <p role="status" className="text-sm text-brand-neon">{es ? 'Código enviado a' : 'Code sent to'} {recipient}. {es ? 'Vence en 15 minutos.' : 'Expires in 15 minutes.'}</p>
                <label htmlFor="apartment-code" className="block text-sm font-bold">{es ? 'Código de verificación' : 'Verification code'}</label>
                <input id="apartment-code" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={es ? 'Código de 6 dígitos' : '6-digit code'} className="w-full rounded-lg border border-white/25 bg-black/40 p-4 text-center text-xl tracking-widest text-white" />
              </>}
              <button type="submit" disabled={busy || (step === 'request' ? !consent || !claim.phoneHint : code.length !== 6)} className="min-h-12 w-full rounded-lg bg-brand-neon px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">{busy ? (es ? 'Procesando…' : 'Processing…') : step === 'request' ? (es ? 'Solicitar Código de Verificación' : 'Request Verification Code') : (es ? 'Verificar código' : 'Verify code')}</button>
              {step === 'verify' && <button type="button" disabled={busy} onClick={() => { setStep('request'); setConsent(false); setCode(''); setError('') }} className="min-h-11 text-sm text-brand-neon underline">{es ? 'Solicitar otro código' : 'Request another code'}</button>}
            </form>}
          </>}
        </>}
        <p className="mt-6 text-sm text-white/70"><Link href={`/${locale}/privacy`} className="underline">{es ? 'Política de privacidad' : 'Privacy Policy'}</Link> · <Link href={`/${locale}/terms`} className="underline">{es ? 'Términos de SMS y servicio' : 'SMS and Service Terms'}</Link></p>
        <div className="mt-8 border-t border-white/15 pt-6 text-sm leading-6 text-white/75">
          <h3 className="font-bold text-white">{es ? '¿No recibes textos en ese número?' : 'Cannot receive texts at that number?'}</h3>
          <p className="mt-2">{es ? 'Algunas líneas de arrendamiento no reciben SMS. Si el número no funciona o necesitas verificar otro contacto, solicita una revisión de tu autorización. No envíes códigos de verificación a otras personas.' : 'Some leasing lines cannot receive SMS. If the number does not work or you need to verify another contact, request a review of your authorization. Do not share verification codes with others.'}</p>
          <Link href={`/${locale}/contact`} className="mt-2 inline-flex min-h-11 items-center font-bold text-brand-neon underline">{es ? 'Solicitar revisión con CityBeat' : 'Request a review with CityBeat'}</Link>
        </div>
      </section>
    </div>
  </CityBeatShell>
}
