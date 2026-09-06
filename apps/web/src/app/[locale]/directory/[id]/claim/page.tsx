'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { DIRECTORY_PLANS, type PlanId } from '@/lib/pricing'
import { RecurringTerms } from '@/components/citybeat/RecurringTerms'

interface Listing {
  id: string
  name: string
  category: string
  address: string | null
  location_count?: number | null
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
  sales_created_listing?: boolean
  claim_contact_email_hint?: string | null
  claim_contact_phone_hint?: string | null
}

// Spanish for the plans a customer is choosing between. lib/pricing.ts is the
// single source of truth for ids, amounts and intervals and is shared with the
// Stripe webhook, so it carries no locale — this translates only what is shown.
// The whole purchase decision (plan names, savings, what you get) rendered in
// English at /es, on the page that takes the card.
const PLAN_ES: Record<PlanId, { label: string; priceLabel: string; badge?: string; savingsLabel?: string; effectiveMonthly?: string; description: string }> = {
  founding_annual: {
    label: 'Fundador Anual',
    priceLabel: '$99 / año',
    effectiveMonthly: '$8.25/mes',
    badge: 'Mejor valor · solo 100',
    savingsLabel: 'Fija $99/año de por vida — ahorra $140 frente al plan mensual',
    description:
      'La oferta de lanzamiento de los 100 Fundadores: todas las funciones Premium al precio más bajo que ofreceremos, fijo mientras mantengas tu suscripción. Galería de fotos, imagen de portada, redes sociales, horario y ubicación prioritaria.',
  },
  founding: {
    label: 'Fundador Mensual',
    priceLabel: '$9.99 / mes',
    badge: 'Lanzamiento · solo 100',
    description:
      'Precio de lanzamiento de los 100 Fundadores — fijo de por vida. Todas las funciones Premium: galería de fotos, imagen de portada, redes sociales, horario y ubicación prioritaria.',
  },
  premium_annual: {
    label: 'Premium Anual',
    priceLabel: '$199 / año',
    effectiveMonthly: '$16.58/mes',
    savingsLabel: '2 meses gratis frente al plan mensual',
    description:
      'Todas las funciones Premium con cobro anual — dos meses gratis frente al mensual. Galería de fotos, imagen de portada, redes sociales, horario y ubicación prioritaria.',
  },
  premium_monthly: {
    label: 'Premium Mensual',
    priceLabel: '$19.99 / mes',
    description:
      'Ficha Premium: galería de fotos, imagen de portada, descripción personalizada, redes sociales, horario día por día y ubicación prioritaria en las búsquedas.',
  },
  featured_monthly: {
    label: 'Destacado',
    priceLabel: '$49 / mes',
    badge: 'Primer lugar',
    description:
      'Todo lo de Premium más el primer lugar de tu categoría, insignia de Destacado y rotación en la portada para máxima visibilidad.',
  },
  sponsored_monthly: {
    label: 'Patrocinado',
    priceLabel: '$99 / mes',
    badge: 'Portada del directorio',
    description:
      'Todo lo de Premium más un espacio en la cuadrícula de Fichas Patrocinadas en la portada del Directorio de CityBeat, la ubicación más visible del sitio. Solo se muestran 3 a la vez, en rotación aleatoria entre todos los patrocinadores, para que todos aparezcan.',
  },
}

function planCopy(planId: PlanId, locale: 'en' | 'es') {
  const plan = DIRECTORY_PLANS[planId]
  if (locale !== 'es') return plan
  return { ...plan, ...PLAN_ES[planId] }
}

// Plan price multiplied across all locations of a multi-location brand.
function planTotalLabel(planId: PlanId, count: number | null | undefined, locale: 'en' | 'es'): string {
  const plan = DIRECTORY_PLANS[planId]
  const n = Math.max(1, Number(count) || 1)
  if (n < 2) return planCopy(planId, locale).priceLabel
  const whole = (plan.unitAmount * n) / 100
  const per = locale === 'es'
    ? plan.interval === 'year' ? '/ año' : '/ mes'
    : plan.interval === 'year' ? '/ yr' : '/ mo'
  const str =
    whole % 1 === 0
      ? whole.toLocaleString('en-US')
      : whole.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${str} ${per}`
}

interface UserProfile {
  id: string
  email: string
}

const translations = {
  en: {
    title: 'Claim Your Business',
    subtitle: 'Verify ownership for free. You can manage your basic information after approval, and upgrades are optional.',
    salesManagedSubtitle: 'Verify ownership for free. Your Sales Desk plan is already set and you will not be charged on this page.',
    priceLabel: 'Monthly Subscription',
    priceValue: '$19.99 / month',
    planFeatureTitle: 'What\'s included with Premium:',
    premiumRank: 'Priority search placement (display at the top of results)',
    premiumCover: 'Custom cover image banner to show off your establishment',
    premiumGallery: 'Visual image gallery showing your atmosphere, food or products',
    premiumSocial: 'Direct click links to Instagram, Facebook & Twitter',
    premiumHours: 'Detailed day-by-day operating hours table',
    loginRequiredTitle: 'Sign In Required',
    loginRequiredDesc: 'To claim a listing, you must first create a CityBeat account or sign in to your existing account so we can link you as the owner.',
    loginBtn: 'Sign In / Register',
    checkoutBtn: 'Upgrade to Premium with Stripe',
    redirecting: 'Redirecting to Stripe...',
    backToDetails: '← Back to listing details',
    loading: 'Loading checkout options...',
    unclaimedStatusError: 'This listing cannot be claimed. It may already be claimed or pending review.',
    forLabel: 'For',
    listingNotFound: 'Listing not found',
    loadError: 'An error occurred loading claim page details',
    startClaimFailed: 'Failed to start claim process',
    invalidCode: 'Invalid verification code',
    genericError: 'An error occurred. Please try again.',
    freeTitle: 'Option 1: Claim Free',
    freeTitleSalesManaged: 'Claim This Listing',
    freeDesc: 'Verify ownership to correct spelling, update phone/website, and edit basic info for free.',
    methodLabel: 'Verification Method',
    methodEmail: 'Email Address',
    methodSms: 'SMS / Text Message',
    methodPostcard: 'Mail Postcard to Business',
    comingSoon: '(coming soon)',
    emailHint: (address: string) =>
      `We'll email a verification code to the address on file for this business: ${address}. You must have access to that inbox to verify ownership.`,
    noEmailOnFile:
      'No email is on file for this business yet, and SMS & postcard verification are coming soon. In the meantime, open the chat in the bottom-right corner and our team will verify your ownership directly.',
    phoneHint: (phone: string) =>
      `We'll text a verification code to the number on file for this business: ${phone}. You must have access to that line to verify ownership.`,
    noPhoneOnFile: 'No phone number is on file for this business. Please use postcard verification instead.',
    postcardHint: (address: string) =>
      `A postcard with a verification code will be mailed to: ${address}. Enter the code once it arrives (5-7 days).`,
    listedAddressFallback: 'Listed Business Address',
    codeLabel: 'Verification Code',
    codePlaceholder: 'Enter 6-digit code',
    backToListing: 'Back to Listing',
    requesting: 'Requesting...',
    requestCode: 'Request Verification Code',
    verifying: 'Verifying...',
    verifyCode: 'Verify Code',
    tryAnotherMethod: 'Try Another Method',
    upgradeTitle: 'Option 2: Upgrade',
    upgradeDesc:
      'Unlock premium features, cover banners, photo gallery, priority placement, and direct social links. Choose a plan:',
    subscribe: 'Subscribe',
  },
  es: {
    title: 'Reclamar Su Negocio',
    subtitle: 'Verifique la propiedad gratis. Podrá administrar la información básica después de la aprobación y las mejoras son opcionales.',
    salesManagedSubtitle: 'Verifique la propiedad gratis. Su plan de Ventas ya está configurado y no se le cobrará en esta página.',
    priceLabel: 'Suscripción Mensual',
    priceValue: '$19.99 / mes',
    planFeatureTitle: 'Qué incluye Premium:',
    premiumRank: 'Ubicación prioritaria en las búsquedas (se muestra arriba)',
    premiumCover: 'Imagen de portada personalizada para lucir su local',
    premiumGallery: 'Galería de fotos que muestra su ambiente, comida o productos',
    premiumSocial: 'Enlaces de clic directo a Instagram, Facebook y Twitter',
    premiumHours: 'Horario detallado de atención día a día',
    loginRequiredTitle: 'Iniciar Sesión Requerido',
    loginRequiredDesc: 'Para reclamar un negocio, primero debe crear una cuenta en CityBeat o iniciar sesión en su cuenta existente para poder vincularlo como propietario.',
    loginBtn: 'Iniciar Sesión / Registrarse',
    checkoutBtn: 'Mejorar a Premium con Stripe',
    redirecting: 'Redireccionando a Stripe...',
    backToDetails: '← Volver a los detalles del negocio',
    loading: 'Cargando opciones de pago...',
    unclaimedStatusError: 'Este perfil no puede ser reclamado. Ya podría estar reclamado o pendiente de revisión.',
    forLabel: 'Para',
    listingNotFound: 'No encontramos este negocio',
    loadError: 'Ocurrió un error al cargar la página de reclamo',
    startClaimFailed: 'No se pudo iniciar el reclamo',
    invalidCode: 'Código de verificación inválido',
    genericError: 'Ocurrió un error. Inténtalo de nuevo.',
    freeTitle: 'Opción 1: Reclamar gratis',
    freeTitleSalesManaged: 'Reclamar este negocio',
    freeDesc:
      'Verifica la propiedad para corregir la ortografía, actualizar el teléfono o el sitio web y editar la información básica, gratis.',
    methodLabel: 'Método de verificación',
    methodEmail: 'Correo electrónico',
    methodSms: 'SMS / Mensaje de texto',
    methodPostcard: 'Tarjeta postal al domicilio del negocio',
    comingSoon: '(próximamente)',
    emailHint: (address: string) =>
      `Enviaremos un código de verificación al correo registrado de este negocio: ${address}. Necesitas acceso a esa bandeja de entrada para comprobar la propiedad.`,
    noEmailOnFile:
      'Este negocio aún no tiene un correo registrado, y la verificación por SMS y por tarjeta postal está por llegar. Mientras tanto, abre el chat en la esquina inferior derecha y nuestro equipo verificará tu propiedad directamente.',
    phoneHint: (phone: string) =>
      `Enviaremos un código de verificación por mensaje al número registrado de este negocio: ${phone}. Necesitas acceso a esa línea para comprobar la propiedad.`,
    noPhoneOnFile:
      'Este negocio no tiene un número de teléfono registrado. Usa la verificación por tarjeta postal.',
    postcardHint: (address: string) =>
      `Enviaremos por correo una tarjeta postal con un código de verificación a: ${address}. Ingresa el código cuando llegue (5-7 días).`,
    listedAddressFallback: 'la dirección registrada del negocio',
    codeLabel: 'Código de verificación',
    codePlaceholder: 'Ingresa el código de 6 dígitos',
    backToListing: 'Volver al negocio',
    requesting: 'Solicitando...',
    requestCode: 'Solicitar código de verificación',
    verifying: 'Verificando...',
    verifyCode: 'Verificar código',
    tryAnotherMethod: 'Probar otro método',
    upgradeTitle: 'Opción 2: Mejorar el plan',
    upgradeDesc:
      'Activa las funciones premium: imagen de portada, galería de fotos, ubicación prioritaria y enlaces directos a tus redes. Elige un plan:',
    subscribe: 'Suscribirse',
  }
}

function ClaimPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (useLocale() || 'en') as 'en' | 'es'
  const t = translations[locale] || translations.en

  const id = params.id as string
  // A salesperson-attested (bypass) handoff carries a signed, single-use token.
  const acceptToken = searchParams.get('accept') || ''

  const [listing, setListing] = useState<Listing | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadClaimData = async () => {
      try {
        setLoading(true)
        // Fetch listing
        const resListing = await fetch(`/api/directory/${id}`)
        if (!resListing.ok) {
          setError(t.listingNotFound)
          return
        }
        const dataListing = await resListing.json()
        const l = dataListing.listing as Listing
        setListing(l)

        if (l.claim_status !== 'unclaimed') {
          setError(t.unclaimedStatusError)
        }

        // Fetch profile
        const resProfile = await fetch('/api/profile')
        if (resProfile.ok) {
          const dataProfile = await resProfile.json()
          setUserProfile(dataProfile.profile as UserProfile)
        }
      } catch (err) {
        console.error(err)
        setError(t.loadError)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadClaimData()
    }
  }, [id, t.unclaimedStatusError, t.listingNotFound, t.loadError])

  const [claimMethod, setClaimMethod] = useState<'email' | 'phone' | 'postcard'>('email')
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('founding_annual')
  const [claimStep, setClaimStep] = useState<'select_method' | 'enter_code' | 'verified'>('select_method')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('')
  const [claimErrorMsg, setClaimErrorMsg] = useState('')
  // Bypass acceptance (?accept=<token>) state.
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [acceptMsg, setAcceptMsg] = useState('')
  const [acceptError, setAcceptError] = useState('')

  const acceptErrorByCode = (code: string | undefined): string => {
    const es = locale === 'es'
    switch (code) {
      case 'wrong_email':
        return es
          ? 'Inicia sesión con el correo exacto que registró tu representante de CityBeat.'
          : 'Sign in with the exact email your CityBeat rep recorded.'
      case 'expired':
        return es ? 'Este enlace de reclamo ha expirado.' : 'This claim link has expired.'
      case 'consumed':
        return es ? 'Este enlace de reclamo ya fue utilizado.' : 'This claim link has already been used.'
      case 'owned':
        return es ? 'Esta ficha ya fue reclamada.' : 'This listing has already been claimed.'
      case 'invalid_token':
      case 'not_bypass':
        return es ? 'Este enlace de reclamo no es válido.' : 'This claim link is invalid.'
      default:
        return es ? 'No se pudo aceptar esta ficha.' : 'Could not accept this listing.'
    }
  }

  const handleAccept = async () => {
    setAccepting(true)
    setAcceptError('')
    try {
      const res = await fetch(`/api/directory/${id}/claim/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: acceptToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAccepted(true)
        setAcceptMsg(
          data.paid
            ? locale === 'es'
              ? 'Propiedad aceptada. Completa el pago para activar tu plan.'
              : 'Ownership accepted. Complete payment to activate your paid plan.'
            : locale === 'es'
              ? '¡Propiedad aceptada! Tu ficha gratis ya está activa.'
              : 'Ownership accepted! Your free listing is now active.'
        )
        router.refresh()
      } else {
        setAcceptError(acceptErrorByCode(data.code))
      }
    } catch {
      setAcceptError(locale === 'es' ? 'Ocurrió un error. Inténtalo de nuevo.' : 'An error occurred. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleStartClaim = async () => {
    setVerifying(true)
    setClaimErrorMsg('')
    try {
      // The verification code is always sent to the contact ON FILE for the
      // business (its listed email/phone/address), never to a user-supplied
      // value — that is what proves ownership.
      const res = await fetch(`/api/directory/${id}/claim/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: claimMethod }),
      })

      const data = await res.json()
      if (res.ok) {
        setClaimStep('enter_code')
        const to = data.recipient ? ` ${data.recipient}` : ''
        setClaimSuccessMsg(
          claimMethod === 'postcard'
            ? (locale === 'es'
                ? '¡Tarjeta postal solicitada! La enviaremos por correo en 5-7 días. Ingrese el código cuando la reciba.'
                : 'Postcard requested! We will mail it in 5-7 days. Enter the code when you receive it.')
            : (locale === 'es'
                ? `Código enviado con éxito a${to}`
                : `Code sent successfully to${to}`)
        )
      } else {
        setClaimErrorMsg(data.error || t.startClaimFailed)
      }
    } catch (err) {
      console.error(err)
      setClaimErrorMsg(t.genericError)
    } finally {
      setVerifying(false)
    }
  }

  const handleVerifyClaim = async () => {
    setVerifying(true)
    setClaimErrorMsg('')
    try {
      if (!verificationCode) {
        setClaimErrorMsg(locale === 'es' ? 'Por favor ingrese el código de verificación.' : 'Please enter the verification code.')
        setVerifying(false)
        return
      }

      const res = await fetch(`/api/directory/${id}/claim/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      })

      const data = await res.json()
      if (res.ok) {
        setClaimStep('verified')
        setClaimSuccessMsg(
          locale === 'es'
            ? '¡Propiedad verificada! Su reclamo está pendiente de revisión por nuestro equipo y será aprobado en breve. Le notificaremos por correo.'
            : 'Ownership verified! Your claim is now pending review by our team and will be approved shortly. We\'ll notify you by email.'
        )
        router.refresh()
      } else {
        setClaimErrorMsg(data.error || t.invalidCode)
      }
    } catch (err) {
      console.error(err)
      setClaimErrorMsg(t.genericError)
    } finally {
      setVerifying(false)
    }
  }

  const handleCheckoutRedirect = async () => {
    setRedirecting(true)
    try {
      let referralCode: string | null = null
      try {
        const stored = JSON.parse(
          window.localStorage.getItem('citybeat_directory_referral') || 'null'
        ) as { code?: string; expiresAt?: number } | null
        if (stored?.code && Number(stored.expiresAt) > Date.now()) {
          referralCode = stored.code
        } else if (stored) {
          window.localStorage.removeItem('citybeat_directory_referral')
        }
      } catch {
        window.localStorage.removeItem('citybeat_directory_referral')
      }

      const response = await fetch('/api/directory/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: id,
          plan: selectedPlan,
          ...(referralCode ? { referral_code: referralCode } : {}),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        // Founding 100 sold out — fall back to standard annual (best value) and retry.
        if (data.founding_sold_out) {
          setSelectedPlan('premium_annual')
        }
        throw new Error(data.error || t.genericError)
      }

      window.location.href = (data as { url: string }).url
    } catch (err: any) {
      console.error(err)
      alert(err.message || t.genericError)
      setRedirecting(false)
    }
  }

  if (loading) {
    return (
      <CityBeatShell locale={locale}>
        <div className="citybeat-app min-h-screen flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-neon"></div>
          <p className="text-white/60 mt-4 font-medium">{t.loading}</p>
        </div>
      </CityBeatShell>
    )
  }

  return (
    <CityBeatShell locale={locale}>
      <div className="citybeat-app min-h-screen pb-24">
        {/* Navigation Breadcrumb */}
        <div className="container-wide pt-8 pb-4">
          <Link href={withLocale(locale, `/directory/${id}`)} className="text-sm font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300 transition">
            {t.backToDetails}
          </Link>
        </div>

        <div className="container-wide max-w-2xl mt-4">
          <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
            {acceptToken ? (
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-neon border border-brand-neon/25 bg-brand-neon/5 px-2.5 py-1 rounded">
                  {listing?.category}
                </span>
                <h1 className="font-display text-3xl sm:text-4xl font-black text-white mt-4 uppercase leading-none">
                  {locale === 'es' ? 'Aceptar Propiedad' : 'Accept Ownership'}
                </h1>
                <p className="text-xs text-white/50 mt-1 uppercase font-bold tracking-wider">
                  {locale === 'es' ? 'Para' : 'For'}: <span className="text-white">{listing?.name}</span>
                </p>

                <div className="mt-8">
                  {accepted ? (
                    <div className="rounded-xl border border-brand-neon/30 bg-brand-neon/10 p-6 text-center">
                      <span className="mb-3 block text-4xl">✓</span>
                      <p className="text-sm text-white/80">{acceptMsg}</p>
                      <Link
                        href={withLocale(locale, `/directory/${id}`)}
                        className="mt-5 inline-block rounded bg-brand-neon px-6 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
                      >
                        {locale === 'es' ? 'Ir a mi ficha' : 'Go to my listing'}
                      </Link>
                    </div>
                  ) : !userProfile ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">{t.loginRequiredTitle}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/60">
                        {locale === 'es'
                          ? 'Inicia sesión con el correo exacto que registró tu representante de CityBeat y luego acepta la propiedad.'
                          : 'Sign in with the exact email your CityBeat rep recorded, then accept ownership.'}
                      </p>
                      <button
                        onClick={() =>
                          router.push(
                            `/${locale}/login?redirectTo=${encodeURIComponent(`/directory/${id}/claim?accept=${acceptToken}`)}`
                          )
                        }
                        className="mt-5 inline-block rounded bg-brand-neon px-6 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
                      >
                        {t.loginBtn}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/[0.06] p-6 text-center">
                      <h3 className="font-display text-lg font-black uppercase tracking-wide text-brand-gold">
                        {locale === 'es' ? 'Aceptar propiedad' : 'Accept ownership'}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/70">
                        {locale === 'es' ? 'Sesión iniciada como' : "You're signed in as"}{' '}
                        <strong className="text-white">{userProfile.email}</strong>.{' '}
                        {locale === 'es'
                          ? 'Debe coincidir con el correo que registró tu representante. Aceptar activa tu ficha gratis (los planes de pago quedan pendientes hasta el pago).'
                          : 'This must match the email your rep recorded. Accepting activates your free listing (paid plans stay pending until payment).'}
                      </p>
                      {acceptError && <p className="mt-3 text-xs font-bold text-brand-magenta">⚠ {acceptError}</p>}
                      <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="mt-5 inline-block rounded bg-brand-neon px-6 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {accepting
                          ? locale === 'es'
                            ? 'Aceptando…'
                            : 'Accepting…'
                          : locale === 'es'
                            ? 'Aceptar propiedad'
                            : 'Accept ownership'}
                      </button>
                      <Link
                        href={withLocale(locale, `/directory/${id}`)}
                        className="mt-3 block text-xs text-white/45 underline hover:text-white"
                      >
                        {t.backToDetails}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <span className="text-brand-magenta font-black text-4xl block mb-4">⚠</span>
                <p className="text-white/80 font-bold mb-4">{error}</p>
                <Link href={withLocale(locale, `/directory/${id}`)} className="btn-primary">
                  {t.backToDetails}
                </Link>
              </div>
            ) : (
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-neon border border-brand-neon/25 bg-brand-neon/5 px-2.5 py-1 rounded">
                  {listing?.category}
                </span>
                
                <h1 className="font-display text-3xl sm:text-4xl font-black text-white mt-4 uppercase leading-none">
                  {t.title}
                </h1>
                
                <p className="text-xs text-white/50 mt-1 uppercase font-bold tracking-wider">
                  {t.forLabel}: <span className="text-white">{listing?.name}</span>
                </p>

                <p className="text-sm text-white/70 mt-4 leading-relaxed">
                  {listing?.sales_created_listing ? t.salesManagedSubtitle : t.subtitle}
                </p>

                {!listing?.sales_created_listing && (
                  <>
                    {/* Checkout Info — reflects the selected optional upgrade plan */}
                    <div className="mt-8 p-6 bg-brand-ink/80 rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{planCopy(selectedPlan, locale).label}</p>
                        <p className="text-2xl font-black text-brand-gold mt-1">{planTotalLabel(selectedPlan, listing?.location_count, locale)}</p>
                        {(listing?.location_count ?? 1) > 1 && (
                          <p className="text-[11px] text-white/50 mt-1">
                            {listing?.location_count} {locale === 'es' ? 'ubicaciones' : 'locations'} × {planCopy(selectedPlan, locale).priceLabel}
                          </p>
                        )}
                      </div>
                      <div className="h-10 w-10 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold">
                        $
                      </div>
                    </div>

                    {/* Recurring-billing disclosure. Nothing on this page said the
                        price repeats — required before charging a card on a
                        schedule, and the only defence against an "I didn't know it
                        renewed" dispute. Free Basic claims are not a subscription,
                        so it only shows for a paid plan. */}
                    {DIRECTORY_PLANS[selectedPlan].unitAmount > 0 && (
                      <RecurringTerms
                        locale={locale}
                        interval={DIRECTORY_PLANS[selectedPlan].interval}
                        className="mt-4"
                      />
                    )}

                    <div className="mt-8 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-brand-neon">
                        {t.planFeatureTitle}
                      </h3>
                      <ul className="space-y-3 text-xs text-white/80 pl-1">
                        <li className="flex items-start gap-2.5">
                          <span className="text-brand-neon font-black flex-shrink-0">✓</span>
                          <span>{t.premiumRank}</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="text-brand-neon font-black flex-shrink-0">✓</span>
                          <span>{t.premiumCover}</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="text-brand-neon font-black flex-shrink-0">✓</span>
                          <span>{t.premiumGallery}</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="text-brand-neon font-black flex-shrink-0">✓</span>
                          <span>{t.premiumSocial}</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="text-brand-neon font-black flex-shrink-0">✓</span>
                          <span>{t.premiumHours}</span>
                        </li>
                      </ul>
                    </div>
                  </>
                )}

                {/* Authentication Check */}
                <div className="mt-10 pt-8 border-t border-white/10">
                  {!userProfile ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                      <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">
                        {t.loginRequiredTitle}
                      </h3>
                      <p className="text-xs text-white/60 mt-2 leading-relaxed">
                        {t.loginRequiredDesc}
                      </p>
                      <button
                        onClick={() => router.push(`/${locale}/login?redirectTo=/directory/${id}/claim`)}
                        className="mt-5 inline-block rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs px-6 py-3 hover:bg-cyan-300 transition"
                      >
                        {t.loginBtn}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {claimErrorMsg && (
                        <div role="alert" className="p-4 bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta rounded-xl text-xs font-bold text-center">
                          ⚠ {claimErrorMsg}
                        </div>
                      )}

                      {claimSuccessMsg && claimStep !== 'verified' && (
                        <div role="status" className="p-4 bg-brand-neon/10 border border-brand-neon/30 text-brand-neon rounded-xl text-xs font-bold text-center">
                          ✓ {claimSuccessMsg}
                        </div>
                      )}

                      <div className={`grid grid-cols-1 gap-6 items-stretch ${listing?.sales_created_listing ? '' : 'md:grid-cols-2'}`}>
                        {/* Free ownership verification */}
                        <div className="citybeat-panel rounded-xl p-5 border border-white/10 flex flex-col justify-between bg-black/20">
                          <div>
                            <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide mb-2">
                              {listing?.sales_created_listing ? t.freeTitleSalesManaged : t.freeTitle}
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed mb-4">
                              {t.freeDesc}
                            </p>

                            {claimStep === 'select_method' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon">
                                    {t.methodLabel}
                                  </label>
                                  <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 p-2.5 rounded border border-white/10 bg-white/5 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        name="claim_method"
                                        checked={claimMethod === 'email'}
                                        onChange={() => { setClaimMethod('email'); setClaimErrorMsg('') }}
                                        className="accent-brand-neon"
                                      />
                                      <span>📧 {t.methodEmail}</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2.5 rounded border border-white/10 bg-white/5 text-xs opacity-40 cursor-not-allowed">
                                      <input type="radio" name="claim_method" disabled className="accent-brand-neon" />
                                      <span>💬 {t.methodSms} <em className="text-white/40">{t.comingSoon}</em></span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2.5 rounded border border-white/10 bg-white/5 text-xs opacity-40 cursor-not-allowed">
                                      <input type="radio" name="claim_method" disabled className="accent-brand-neon" />
                                      <span>📮 {t.methodPostcard} <em className="text-white/40">{t.comingSoon}</em></span>
                                    </label>
                                  </div>
                                </div>

                                {claimMethod === 'email' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    {listing?.claim_contact_email_hint ? (
                                      t.emailHint(listing.claim_contact_email_hint)
                                    ) : (
                                      <span className="text-brand-gold">{t.noEmailOnFile}</span>
                                    )}
                                  </div>
                                )}

                                {claimMethod === 'phone' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    {listing?.claim_contact_phone_hint ? (
                                      t.phoneHint(listing.claim_contact_phone_hint)
                                    ) : (
                                      <span className="text-brand-gold">{t.noPhoneOnFile}</span>
                                    )}
                                  </div>
                                )}

                                {claimMethod === 'postcard' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    {t.postcardHint(listing?.address || t.listedAddressFallback)}
                                  </div>
                                )}
                              </div>
                            )}

                            {claimStep === 'enter_code' && (
                              <div className="space-y-4">
                                <label htmlFor="claim-verification-code" className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon">
                                  {t.codeLabel}
                                </label>
                                <input
                                  id="claim-verification-code"
                                  type="text"
                                  inputMode="numeric"
                                  aria-label={t.codeLabel}
                                  placeholder={t.codePlaceholder}
                                  maxLength={6}
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value)}
                                  className="w-full text-center tracking-widest text-lg font-bold rounded p-2.5 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none"
                                />
                              </div>
                            )}

                            {claimStep === 'verified' && (
                              <div className="text-center py-4 space-y-4">
                                <span className="text-4xl">⏳</span>
                                <p className="text-xs text-white/75">{claimSuccessMsg}</p>
                                <Link
                                  href={withLocale(locale, `/directory/${id}`)}
                                  className="inline-block w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3"
                                >
                                  {t.backToListing}
                                </Link>
                              </div>
                            )}
                          </div>

                          {claimStep !== 'verified' && (
                            <div className="mt-6 space-y-2">
                              {claimStep === 'select_method' ? (
                                <button
                                  onClick={handleStartClaim}
                                  disabled={verifying || (claimMethod === 'email' && !listing?.claim_contact_email_hint)}
                                  className="w-full text-center rounded bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {verifying ? t.requesting : t.requestCode}
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={handleVerifyClaim}
                                    disabled={verifying}
                                    className="w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3 transition hover:bg-cyan-300 disabled:opacity-50"
                                  >
                                    {verifying ? t.verifying : t.verifyCode}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setClaimStep('select_method'); setClaimSuccessMsg(''); setClaimErrorMsg('') }}
                                    className="w-full text-center text-xs text-white/50 hover:text-white underline mt-2 block"
                                  >
                                    {t.tryAnotherMethod}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {!listing?.sales_created_listing && (
                          <div className="citybeat-panel rounded-xl p-5 border border-brand-gold/30 bg-gradient-to-b from-brand-charcoal to-brand-dark flex flex-col justify-between shadow-[0_0_15px_rgba(255,215,0,0.05)]">
                          <div>
                            <h3 className="font-display text-lg font-black text-brand-gold uppercase tracking-wide mb-2">
                              {t.upgradeTitle}
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed mb-4">
                              {t.upgradeDesc}
                            </p>

                            <div className="flex flex-col gap-2 my-4">
                              {(['founding_annual', 'founding', 'premium_annual', 'premium_monthly', 'featured_monthly'] as PlanId[]).map((pid) => {
                                const p = planCopy(pid, locale)
                                const active = selectedPlan === pid
                                const isBestValue = pid === 'founding_annual'
                                return (
                                  <label
                                    key={pid}
                                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                                      active
                                        ? 'border-brand-gold bg-brand-gold/10'
                                        : isBestValue
                                          ? 'border-brand-gold/40 bg-brand-gold/5 hover:border-brand-gold/60'
                                          : 'border-white/10 bg-white/5 hover:border-white/25'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name="plan"
                                      checked={active}
                                      onChange={() => setSelectedPlan(pid)}
                                      className="accent-brand-gold mt-0.5"
                                    />
                                    <span className="flex-1">
                                      <span className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                          {p.label}
                                          {p.badge && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${isBestValue ? 'bg-brand-gold/25 text-brand-gold' : 'bg-brand-neon/20 text-brand-neon'}`}>
                                              {p.badge}
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-right whitespace-nowrap">
                                          <span className="block text-xs font-black text-brand-gold">{p.priceLabel}</span>
                                          {p.effectiveMonthly && (
                                            <span className="block text-[9px] text-white/40">{p.effectiveMonthly}</span>
                                          )}
                                        </span>
                                      </span>
                                      {p.savingsLabel && (
                                        <span className="block text-[10px] font-bold text-green-400 mt-1">✓ {p.savingsLabel}</span>
                                      )}
                                      <span className="block text-[10px] text-white/50 mt-1 leading-snug">{p.description}</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          <button
                            onClick={handleCheckoutRedirect}
                            disabled={redirecting}
                            className="w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3.5 hover:bg-cyan-300 transition shadow-[0_4px_12px_rgba(0,240,255,0.25)] disabled:opacity-50 mt-2"
                          >
                            {redirecting ? t.redirecting : `${t.subscribe} · ${planTotalLabel(selectedPlan, listing?.location_count, locale)}`}
                          </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CityBeatShell>
  )
}

export default function ClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimPageInner />
    </Suspense>
  )
}
