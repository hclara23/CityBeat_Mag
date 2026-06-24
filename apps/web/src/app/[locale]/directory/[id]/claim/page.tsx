'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { DIRECTORY_PLANS, type PlanId } from '@/lib/pricing'

interface Listing {
  id: string
  name: string
  category: string
  address: string | null
  phone?: string | null
  email?: string | null
  location_count?: number | null
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
}

// Plan price multiplied across all locations of a multi-location brand.
function planTotalLabel(planId: PlanId, count?: number | null): string {
  const plan = DIRECTORY_PLANS[planId]
  const n = Math.max(1, Number(count) || 1)
  if (n < 2) return plan.priceLabel
  const whole = (plan.unitAmount * n) / 100
  const per = plan.interval === 'year' ? '/ yr' : '/ mo'
  const str =
    whole % 1 === 0
      ? whole.toLocaleString('en-US')
      : whole.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${str} ${per}`
}

// Mask a listed contact so we can show the owner where the code will go without
// exposing the full address/number to anyone browsing the claim page.
function maskClient(value: string | null | undefined, type: 'email' | 'phone'): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v) return null
  if (type === 'email') {
    const [local, domain] = v.split('@')
    if (!domain) return null
    return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
  }
  const digits = v.replace(/\D/g, '')
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null
}

interface UserProfile {
  id: string
  email: string
}

const translations = {
  en: {
    title: 'Claim Your Business',
    subtitle: 'Upgrade your directory listing to Premium to build trust, attract customers, and stand out.',
    priceLabel: 'Monthly Subscription',
    priceValue: '$19.00 / month',
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
  },
  es: {
    title: 'Reclamar Su Negocio',
    subtitle: 'Mejore su perfil en el directorio a Premium para generar confianza, atraer clientes y destacar.',
    priceLabel: 'Suscripción Mensual',
    priceValue: '$19.00 / mes',
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
  }
}

export default function ClaimPage() {
  const params = useParams()
  const router = useRouter()
  const locale = (useLocale() || 'en') as 'en' | 'es'
  const t = translations[locale] || translations.en

  const id = params.id as string

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
          setError('Listing not found')
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
        setError('An error occurred loading claim page details')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadClaimData()
    }
  }, [id, t.unclaimedStatusError])

  const [claimMethod, setClaimMethod] = useState<'email' | 'phone' | 'postcard'>('email')
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('founding')
  const [claimStep, setClaimStep] = useState<'select_method' | 'enter_code' | 'verified'>('select_method')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('')
  const [claimErrorMsg, setClaimErrorMsg] = useState('')

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
        setClaimErrorMsg(data.error || 'Failed to start claim process')
      }
    } catch (err) {
      console.error(err)
      setClaimErrorMsg('An error occurred. Please try again.')
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
        setClaimErrorMsg(data.error || 'Invalid verification code')
      }
    } catch (err) {
      console.error(err)
      setClaimErrorMsg('An error occurred. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCheckoutRedirect = async () => {
    setRedirecting(true)
    try {
      const response = await fetch('/api/directory/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: id,
          plan: selectedPlan,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        // Founding 100 sold out — fall back to standard monthly and let them retry.
        if (data.founding_sold_out) {
          setSelectedPlan('premium_monthly')
        }
        throw new Error(data.error || 'Failed to create checkout session')
      }

      window.location.href = (data as { url: string }).url
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error redirecting to Stripe')
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
            {error ? (
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
                  For: <span className="text-white">{listing?.name}</span>
                </p>

                <p className="text-sm text-white/70 mt-4 leading-relaxed">
                  {t.subtitle}
                </p>

                {/* Checkout Info — reflects the selected upgrade plan */}
                <div className="mt-8 p-6 bg-brand-ink/80 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{DIRECTORY_PLANS[selectedPlan].label}</p>
                    <p className="text-2xl font-black text-brand-gold mt-1">{planTotalLabel(selectedPlan, listing?.location_count)}</p>
                    {(listing?.location_count ?? 1) > 1 && (
                      <p className="text-[11px] text-white/50 mt-1">
                        {listing?.location_count} {locale === 'es' ? 'ubicaciones' : 'locations'} × {DIRECTORY_PLANS[selectedPlan].priceLabel}
                      </p>
                    )}
                  </div>
                  <div className="h-10 w-10 rounded-full bg-brand-gold/10 text-brand-gold flex items-center justify-center font-bold">
                    $
                  </div>
                </div>

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
                        <div className="p-4 bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta rounded-xl text-xs font-bold text-center">
                          ⚠ {claimErrorMsg}
                        </div>
                      )}

                      {claimSuccessMsg && claimStep !== 'verified' && (
                        <div className="p-4 bg-brand-neon/10 border border-brand-neon/30 text-brand-neon rounded-xl text-xs font-bold text-center">
                          ✓ {claimSuccessMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                        {/* Option 1: Claim Free */}
                        <div className="citybeat-panel rounded-xl p-5 border border-white/10 flex flex-col justify-between bg-black/20">
                          <div>
                            <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide mb-2">
                              Option 1: Claim Free
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed mb-4">
                              Verify ownership to correct spelling, update phone/website, and edit basic info for free.
                            </p>

                            {claimStep === 'select_method' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon">
                                    Verification Method
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
                                      <span>📧 Email Address</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2.5 rounded border border-white/10 bg-white/5 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        name="claim_method"
                                        checked={claimMethod === 'phone'}
                                        onChange={() => { setClaimMethod('phone'); setClaimErrorMsg('') }}
                                        className="accent-brand-neon"
                                      />
                                      <span>💬 SMS / Text Message</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2.5 rounded border border-white/10 bg-white/5 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        name="claim_method"
                                        checked={claimMethod === 'postcard'}
                                        onChange={() => { setClaimMethod('postcard'); setClaimErrorMsg('') }}
                                        className="accent-brand-neon"
                                      />
                                      <span>📮 Mail Postcard to Business</span>
                                    </label>
                                  </div>
                                </div>

                                {claimMethod === 'email' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    {maskClient(listing?.email, 'email') ? (
                                      <>We&apos;ll email a verification code to the address on file for this business: <strong className="text-white">{maskClient(listing?.email, 'email')}</strong>. You must have access to that inbox to verify ownership.</>
                                    ) : (
                                      <span className="text-brand-gold">No email is on file for this business. Please use SMS or postcard verification instead.</span>
                                    )}
                                  </div>
                                )}

                                {claimMethod === 'phone' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    {maskClient(listing?.phone, 'phone') ? (
                                      <>We&apos;ll text a verification code to the number on file for this business: <strong className="text-white">{maskClient(listing?.phone, 'phone')}</strong>. You must have access to that line to verify ownership.</>
                                    ) : (
                                      <span className="text-brand-gold">No phone number is on file for this business. Please use postcard verification instead.</span>
                                    )}
                                  </div>
                                )}

                                {claimMethod === 'postcard' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    A postcard with a verification code will be mailed to: <strong className="text-white">{listing?.address || 'Listed Business Address'}</strong>. Enter the code once it arrives (5–7 days).
                                  </div>
                                )}
                              </div>
                            )}

                            {claimStep === 'enter_code' && (
                              <div className="space-y-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon">
                                  Verification Code
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter 6-digit code"
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
                                  Back to Listing
                                </Link>
                              </div>
                            )}
                          </div>

                          {claimStep !== 'verified' && (
                            <div className="mt-6 space-y-2">
                              {claimStep === 'select_method' ? (
                                <button
                                  onClick={handleStartClaim}
                                  disabled={verifying}
                                  className="w-full text-center rounded bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-3 transition disabled:opacity-50"
                                >
                                  {verifying ? 'Requesting...' : 'Request Verification Code'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={handleVerifyClaim}
                                    disabled={verifying}
                                    className="w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3 transition hover:bg-cyan-300 disabled:opacity-50"
                                  >
                                    {verifying ? 'Verify Code' : 'Verify Code'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setClaimStep('select_method'); setClaimSuccessMsg(''); setClaimErrorMsg('') }}
                                    className="w-full text-center text-xs text-white/50 hover:text-white underline mt-2 block"
                                  >
                                    Try Another Method
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Option 2: Claim Premium / Featured */}
                        <div className="citybeat-panel rounded-xl p-5 border border-brand-gold/30 bg-gradient-to-b from-brand-charcoal to-brand-dark flex flex-col justify-between shadow-[0_0_15px_rgba(255,215,0,0.05)]">
                          <div>
                            <h3 className="font-display text-lg font-black text-brand-gold uppercase tracking-wide mb-2">
                              Option 2: Upgrade
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed mb-4">
                              Unlock premium features, cover banners, photo gallery, priority placement, and direct social links. Choose a plan:
                            </p>

                            <div className="flex flex-col gap-2 my-4">
                              {(['founding', 'premium_monthly', 'premium_annual', 'featured_monthly'] as PlanId[]).map((pid) => {
                                const p = DIRECTORY_PLANS[pid]
                                const active = selectedPlan === pid
                                return (
                                  <label
                                    key={pid}
                                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                                      active
                                        ? 'border-brand-gold bg-brand-gold/10'
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
                                          {pid === 'founding' && (
                                            <span className="text-[9px] bg-brand-neon/20 text-brand-neon px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                              Launch · 100 only
                                            </span>
                                          )}
                                          {pid === 'featured_monthly' && (
                                            <span className="text-[9px] bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                              Top spot
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-xs font-black text-brand-gold whitespace-nowrap">{p.priceLabel}</span>
                                      </span>
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
                            {redirecting ? t.redirecting : `Subscribe · ${planTotalLabel(selectedPlan, listing?.location_count)}`}
                          </button>
                        </div>
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
