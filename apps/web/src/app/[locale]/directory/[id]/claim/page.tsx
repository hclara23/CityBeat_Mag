'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

interface Listing {
  id: string
  name: string
  category: string
  address: string | null
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
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
  const [contactInput, setContactInput] = useState('')
  const [claimStep, setClaimStep] = useState<'select_method' | 'enter_code' | 'verified'>('select_method')
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('')
  const [claimErrorMsg, setClaimErrorMsg] = useState('')

  const handleStartClaim = async () => {
    setVerifying(true)
    setClaimErrorMsg('')
    try {
      const contactInfo = claimMethod === 'postcard' ? '' : contactInput
      if (claimMethod !== 'postcard' && !contactInfo) {
        setClaimErrorMsg(locale === 'es' ? 'Por favor ingrese la información de contacto.' : 'Please enter contact details.')
        setVerifying(false)
        return
      }

      const res = await fetch(`/api/directory/${id}/claim/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: claimMethod, contactInfo }),
      })

      const data = await res.json()
      if (res.ok) {
        setClaimStep('enter_code')
        setClaimSuccessMsg(
          claimMethod === 'postcard'
            ? (locale === 'es'
                ? '¡Tarjeta postal solicitada! La enviaremos por correo en 5-7 días. Ingrese el código cuando la reciba.'
                : 'Postcard requested! We will mail it in 5-7 days. Enter the code when you receive it.')
            : (locale === 'es'
                ? `Código enviado con éxito a ${contactInfo}`
                : `Code sent successfully to ${contactInfo}`)
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
            ? '¡Felicitaciones! Su negocio ha sido reclamado con éxito. Ahora puede editar la información básica.'
            : 'Congratulations! Your business is successfully verified. You can now edit basic details.'
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
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const session = (await response.json()) as { url: string }
      window.location.href = session.url
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
          <Link href={`/directory/${id}`} className="text-sm font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300 transition">
            {t.backToDetails}
          </Link>
        </div>

        <div className="container-wide max-w-2xl mt-4">
          <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
            {error ? (
              <div className="text-center py-6">
                <span className="text-brand-magenta font-black text-4xl block mb-4">⚠</span>
                <p className="text-white/80 font-bold mb-4">{error}</p>
                <Link href={`/directory/${id}`} className="btn-primary">
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

                {/* Checkout Info */}
                <div className="mt-8 p-6 bg-brand-ink/80 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{t.priceLabel}</p>
                    <p className="text-2xl font-black text-brand-gold mt-1">{t.priceValue}</p>
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
                                  <input
                                    type="email"
                                    placeholder="owner@mybusiness.com"
                                    value={contactInput}
                                    onChange={(e) => setContactInput(e.target.value)}
                                    className="w-full rounded p-2.5 border border-white/15 bg-black/40 text-xs text-white focus:border-brand-neon focus:outline-none"
                                  />
                                )}

                                {claimMethod === 'phone' && (
                                  <input
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    value={contactInput}
                                    onChange={(e) => setContactInput(e.target.value)}
                                    className="w-full rounded p-2.5 border border-white/15 bg-black/40 text-xs text-white focus:border-brand-neon focus:outline-none"
                                  />
                                )}

                                {claimMethod === 'postcard' && (
                                  <div className="p-3 bg-white/5 border border-white/5 rounded text-[11px] text-white/70">
                                    Postcard will be mailed to: <strong className="text-white">{listing?.address || 'Listed Business Address'}</strong>
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
                                <span className="text-4xl">🎉</span>
                                <p className="text-xs text-white/75">{claimSuccessMsg}</p>
                                <Link
                                  href={`/directory/${id}`}
                                  className="inline-block w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3"
                                >
                                  Manage Basic Info
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

                        {/* Option 2: Claim Premium */}
                        <div className="citybeat-panel rounded-xl p-5 border border-brand-gold/30 bg-gradient-to-b from-brand-charcoal to-brand-dark flex flex-col justify-between shadow-[0_0_15px_rgba(255,215,0,0.05)]">
                          <div>
                            <h3 className="font-display text-lg font-black text-brand-gold uppercase tracking-wide mb-2 flex items-center justify-between">
                              <span>Option 2: Premium</span>
                              <span className="text-xs bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded font-bold">$19/mo</span>
                            </h3>
                            <p className="text-xs text-white/60 leading-relaxed mb-4">
                              Instantly unlock premium features, cover banners, visual photos gallery, priority placement, and direct social links.
                            </p>

                            <ul className="text-[11px] text-white/80 space-y-2.5 pl-1 my-4">
                              <li className="flex items-center gap-2">
                                <span className="text-brand-neon font-black">✓</span>
                                {t.premiumRank}
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="text-brand-neon font-black">✓</span>
                                {t.premiumCover}
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="text-brand-neon font-black">✓</span>
                                {t.premiumGallery}
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="text-brand-neon font-black">✓</span>
                                {t.premiumSocial}
                              </li>
                            </ul>
                          </div>

                          <button
                            onClick={handleCheckoutRedirect}
                            disabled={redirecting}
                            className="w-full text-center rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3.5 hover:bg-cyan-300 transition shadow-[0_4px_12px_rgba(0,240,255,0.25)] disabled:opacity-50 mt-6"
                          >
                            {redirecting ? t.redirecting : 'Verify & Go Premium'}
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
