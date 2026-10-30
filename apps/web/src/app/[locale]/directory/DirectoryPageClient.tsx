'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import nextDynamic from 'next/dynamic'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

import { AdBanner } from '@/components/citybeat/AdBanner'
import { categoryLabel, DIRECTORY_CATEGORIES } from '@/lib/categories'
import { selectSponsoredWindow } from '@/lib/sponsored-rotation'
import { PrintBadges } from '@/components/citybeat/PrintRecognition'
import { cleanListingText } from '@/lib/customer-experience'

// `export const dynamic` (route segment config) only takes effect from a
// Server Component — Next.js silently ignores it in a 'use client' module, so
// that declaration lives in page.tsx, which just renders this component.

const DirectoryMap = nextDynamic(() => import('@/components/DirectoryMap'), { ssr: false })

interface Listing {
  print_recognition?: unknown
  id: string
  name: string
  description: string | null
  category: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  user_ratings_total: number | null
  tier: 'basic' | 'premium' | 'featured'
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
  image_url: string | null
  is_sponsored?: boolean
  sponsored_since?: string | null
  created_at?: string | null
  location_count?: number | null
  latitude?: number | null
  longitude?: number | null
}

function LocationBadge({ count }: { count?: number | null }) {
  if (!count || count < 2) return null
  return (
    <span className="ml-2 align-middle inline-block text-[10px] font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 border border-brand-neon/25 px-1.5 py-0.5 rounded">
      📍 {count} locations
    </span>
  )
}

// Value stays English (matches listing.category); label is localized on render.
// Derived from the canonical category list so a new ingest vertical (see
// lib/categories.ts) is automatically browsable here — this used to be a
// hand-maintained subset that silently excluded every category added after it
// was written (Electrical Contractors, Automation & Controls, Industrial
// Supply, Event Services, Childcare & Education, Logistics & Freight, plus
// Auto Dealer/Entertainment/Arts & Culture/Professional Services/Title &
// Notary/Web Development from even earlier).
const CATEGORIES = ['All', ...DIRECTORY_CATEGORIES]

const DIRECTORY_SHORTCUTS = [
  { category: 'Restaurant', icon: '🍴', tone: 'bg-cyan-500' },
  { category: 'Retail', icon: '▣', tone: 'bg-fuchsia-500' },
  { category: 'Health', icon: '♥', tone: 'bg-rose-500' },
  { category: 'Home Services', icon: '◆', tone: 'bg-sky-500' },
  { category: 'Professional Services', icon: '▰', tone: 'bg-indigo-500' },
  { category: 'Arts & Culture', icon: '♫', tone: 'bg-pink-500' },
  { category: 'Auto Repair', icon: '●', tone: 'bg-slate-700' },
] as const

const translations = {
  en: {
    title: 'Local Business Directory',
    subtitle: 'The El Paso business directory — find local restaurants, home services, contractors, auto shops, salons, doctors, attorneys and more across El Paso, Las Cruces, and the borderlands. Read reviews, see hours, and connect directly.',
    searchPlaceholder: 'Search by name, category, address...',
    allCategories: 'All Categories',
    premiumTitle: 'Featured Premium Listings',
    premiumExplainer: 'Paid partners use richer profiles, receive complete leads, and appear in this larger-card section before Basic listings.',
    basicTitle: 'Local Businesses',
    basicExplainer: 'Basic listings are public and searchable. A verified owner can keep essential contact details and hours accurate for free.',
    basicPlanLabel: 'Basic · Free',
    noResults: 'No businesses found matching your criteria.',
    ratingVal: 'rating',
    reviews: 'reviews',
    claimBadge: 'Unclaimed',
    pendingBadge: 'Pending Approval',
    approvedBadge: 'Verified Partner',
    claimBtn: 'Claim Free / See Premium',
    viewDetails: 'View Details',
    premiumGlowText: 'PREMIUM PARTNER',
    referralSaved: 'Referral saved. Choose your business and complete signup within 30 days.',
    referralInvalid: 'That referral link is inactive, but you can still browse and join the directory.',
  },
  es: {
    title: 'Directorio de Negocios Locales',
    subtitle: 'El directorio de negocios de El Paso — encuentra restaurantes, servicios para el hogar, contratistas, talleres, salones, médicos, abogados y más en El Paso, Las Cruces y la frontera. Lee reseñas, ve horarios y contacta directamente.',
    searchPlaceholder: 'Buscar por nombre, categoría, dirección...',
    allCategories: 'Todas las Categorías',
    premiumTitle: 'Negocios Premium Destacados',
    premiumExplainer: 'Los socios de pago tienen perfiles más completos, reciben prospectos completos y aparecen con tarjetas grandes antes de las fichas Básicas.',
    basicTitle: 'Negocios Locales',
    basicExplainer: 'Las fichas Básicas son públicas y aparecen en búsquedas. El propietario verificado puede mantener gratis los datos esenciales y el horario.',
    basicPlanLabel: 'Básico · Gratis',
    noResults: 'No se encontraron negocios con estos criterios.',
    ratingVal: 'calificación',
    reviews: 'reseñas',
    claimBadge: 'Sin Reclamar',
    pendingBadge: 'Pendiente de Aprobación',
    approvedBadge: 'Socio Verificado',
    claimBtn: 'Reclamar gratis / Ver Premium',
    viewDetails: 'Ver Detalles',
    premiumGlowText: 'SOCIO PREMIUM',
    referralSaved: 'Referido guardado. Elige tu negocio y completa el registro dentro de 30 días.',
    referralInvalid: 'Ese enlace de referido está inactivo, pero aún puedes explorar y unirte al directorio.',
  }
}

export default function DirectoryPageClient({ browseLinks }: { browseLinks?: ReactNode } = {}) {
  const locale = useLocale() as 'en' | 'es'
  const t = translations[locale] || translations.en
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [page, setPage] = useState(0)
  const [pageInfo, setPageInfo] = useState({ total: 0, hasMore: false, pageCount: 0, visibilityChanged: false })
  const [location, setLocation] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [referralNotice, setReferralNotice] = useState<'saved' | 'invalid' | 'inactive' | null>(null)
  // The map (Leaflet, ~140 kB) is opt-in so it never blocks the listings the
  // visitor came for — it only mounts + downloads when "Show map" is clicked.
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const value = searchParams.get('referral')
    if (value === 'saved' || value === 'invalid' || value === 'inactive') {
      setReferralNotice(value)
    }
    const referralCode = searchParams.get('ref')?.trim().toUpperCase()
    if (value === 'saved' && referralCode && /^[A-F0-9]{12}$/.test(referralCode)) {
      try {
      window.localStorage.setItem(
        'citybeat_directory_referral',
        JSON.stringify({
          code: referralCode,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        })
      )
      } catch {
        // Storage may be disabled; directory browsing must still initialize.
      }
    }
    // Seed the search box from ?q= so Google's sitelinks search box (WebSite
    // SearchAction) and any deep link land on a real filtered result set.
    const readFilters = () => {
      const params = new URLSearchParams(window.location.search)
      setSearchQuery((params.get('q') || '').slice(0, 100))
      const category = params.get('category') || 'All'
      setSelectedCategory(CATEGORIES.includes(category as typeof CATEGORIES[number]) ? category : 'All')
      setLocation((params.get('location') || '').slice(0, 80))
      setPage(Math.max(0, Number.parseInt(params.get('page') || '0', 10) || 0))
      setFiltersReady(true)
    }
    readFilters()
    window.addEventListener('popstate', readFilters)
    return () => window.removeEventListener('popstate', readFilters)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    const controller = new AbortController()
    setLoading(true)
    const fetchListings = async () => {
      try {
        setLoading(true)
        setLoadError(false)
        const categoryParam = selectedCategory === 'All' ? '' : selectedCategory
        const url = new URL(window.location.href)
        for (const [key, value] of Object.entries({ q: searchQuery, category: categoryParam, location, page: page ? String(page) : '' })) {
          if (value) url.searchParams.set(key, value); else url.searchParams.delete(key)
        }
        window.history.replaceState(window.history.state, '', url)
        const params = new URLSearchParams({ query: searchQuery, category: categoryParam, location, page: String(page) })
        const response = await fetch(`/api/directory?${params}`, { signal: controller.signal })
        if (response.ok) {
          const data = await response.json()
          if (controller.signal.aborted) return
          setListings(data.listings || [])
          setPageInfo({ total: data.total || 0, hasMore: !!data.hasMore, pageCount: data.pageCount || 0, visibilityChanged: !!data.visibilityChanged })
          if (data.page !== page) setPage(data.page || 0)
        } else { setListings([]); setLoadError(true) }
      } catch (err) {
        if (!controller.signal.aborted) { setListings([]); setLoadError(true) }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchListings()
    }, 300)

    return () => { clearTimeout(timer); controller.abort() }
  }, [searchQuery, selectedCategory, location, page, retry, filtersReady])

  const clearFilters = () => { setSearchQuery(''); setSelectedCategory('All'); setLocation(''); setPage(0) }
  const changePage = (next: number) => {
    setPage(next)
    document.getElementById('directory-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return null
    const stars = []
    const floor = Math.floor(rating)
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <svg
          key={i}
          className={`h-3.5 w-3.5 ${i <= floor ? 'text-brand-gold fill-brand-gold' : 'text-gray-600'}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
  }

  // The grid shows at most 3 cards; any number of listings can be sponsored
  // at once, so once more than 3 qualify, a random 3 (in random order) show
  // per view — see selectSponsoredWindow.
  const sponsoredListings = useMemo(() => selectSponsoredWindow(listings.filter((l) => l.is_sponsored)), [listings])
  const spotlightIds = new Set(sponsoredListings.map(l => l.id))
  // Featured and Premium both appear in the premium section; Featured ranks first.
  const premiumListings = listings
    .filter((l) => (l.tier === 'premium' || l.tier === 'featured') && !spotlightIds.has(l.id))
    .sort((a, b) => (a.tier === 'featured' ? -1 : 0) - (b.tier === 'featured' ? -1 : 0))
  const basicListings = listings.filter(
    (l) => l.tier !== 'premium' && l.tier !== 'featured' && !spotlightIds.has(l.id)
  )

  return (
    <CityBeatShell locale={locale}>
      <div className="citybeat-app min-h-screen pb-24">
        {referralNotice && (
          <div className={`border-b px-4 py-3 text-center text-sm font-bold ${referralNotice === 'saved' ? 'border-brand-neon/30 bg-brand-neon/10 text-brand-neon' : 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'}`}>
            {referralNotice === 'saved' ? t.referralSaved : t.referralInvalid}
          </div>
        )}
        {/* Editorial directory finder: compact on desktop and app-like on mobile. */}
        <section className="border-b border-white/10 bg-[#080d13] py-7 sm:py-10">
          <div className="container-wide">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-white text-slate-950 shadow-[0_25px_80px_rgba(0,0,0,.32)]">
              <div className="grid lg:grid-cols-[.86fr_1.14fr]">
                <div className="relative overflow-hidden bg-[#0a1723] p-5 text-white sm:p-10 lg:p-12">
                  <div className="absolute inset-0 opacity-30 citybeat-grid" />
                  <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-brand-neon/20 blur-3xl" />
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{locale === 'es' ? 'Compra local. Crece local.' : 'Shop local. Grow local.'}</p>
                      <h1 className="mt-3 max-w-xl font-display text-3xl font-black uppercase leading-tight tracking-[-.03em] sm:text-5xl lg:text-6xl">
                        {locale === 'es' ? 'Directorio de negocios' : 'Business directory'}
                      </h1>
                      <p className="mt-3 text-sm text-white/75 sm:hidden">{locale === 'es' ? 'Encuentra, compara y contacta negocios locales.' : 'Find, compare and contact local businesses.'}</p>
                      <p className="mt-6 hidden max-w-xl text-base leading-7 text-white/72 sm:block">{t.subtitle}</p>
                    </div>
                    <div className="mt-10 hidden flex-wrap gap-3 text-xs font-black uppercase tracking-[0.15em] sm:flex">
                      <span className="rounded-full border border-brand-neon/45 bg-brand-neon/10 px-4 py-2 text-brand-neon">El Paso</span>
                      <span className="rounded-full border border-white/20 px-4 py-2 text-white/75">Las Cruces</span>
                      <span className="rounded-full border border-white/20 px-4 py-2 text-white/75">Borderlands</span>
                      <Link href={`/${locale}/apartments`} className="rounded-full border border-white/20 px-4 py-2 text-white/75 hover:border-brand-neon hover:text-brand-neon">{locale === 'es' ? 'Apartamentos' : 'Apartments'} →</Link>
                    </div>
                  </div>
                </div>

                <div className="directory-search-light p-6 sm:p-9 lg:p-12">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">CityBeat local guide</p>
                      <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{locale === 'es' ? 'Encuentra un negocio' : 'Find a local business'}</h2>
                    </div>
                    <span aria-hidden="true" className="hidden text-3xl sm:block">⌕</span>
                  </div>

                  <label className="relative mt-6 block">
                    <span className="sr-only">{t.searchPlaceholder}</span>
                    <input
                      type="search"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      maxLength={100}
                      onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-base font-semibold text-slate-950 placeholder:text-slate-400 focus:border-cyan-600 focus:ring-cyan-600"
                    />
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </label>

                  <label className="mt-4 block text-sm font-bold text-slate-800">
                    {locale === 'es' ? 'Ciudad o código postal' : 'City or ZIP code'}
                    <input type="search" maxLength={80} value={location} onChange={e => { setLocation(e.target.value); setPage(0) }} placeholder={locale === 'es' ? 'Todas las zonas · p. ej. 79936' : 'All areas · e.g. El Paso or 79936'} className="mt-2 h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-950 focus:border-cyan-600 focus:ring-cyan-600" />
                  </label>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {DIRECTORY_SHORTCUTS.map((item) => {
                      const isActive = selectedCategory === item.category
                      return (
                        <button
                          type="button"
                          key={item.category}
                          onClick={() => { setSelectedCategory(isActive ? 'All' : item.category); setPage(0) }}
                          aria-pressed={isActive}
                          className={`hidden min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-bold transition sm:flex ${isActive ? 'border-cyan-600 bg-cyan-50 text-cyan-950' : 'border-slate-200 bg-white text-slate-800 hover:border-cyan-500 hover:bg-cyan-50/60'}`}
                        >
                          <span aria-hidden="true" className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white ${item.tone}`}>{item.icon}</span>
                          <span>{categoryLabel(item.category, locale)}</span>
                        </button>
                      )
                    })}
                    <label className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                      <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-300 text-slate-800">•••</span>
                      <span className="sr-only">{t.allCategories}</span>
                      <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(0) }} className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-bold text-slate-800 focus:ring-cyan-600">
                        {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat === 'All' ? t.allCategories : categoryLabel(cat, locale)}</option>)}
                      </select>
                    </label>
                  </div>

                  {(searchQuery || location || selectedCategory !== 'All') && (
                    <button type="button" onClick={clearFilters} className="mt-3 min-h-11 text-xs font-black uppercase tracking-wider text-cyan-700 hover:text-cyan-900">
                      {locale === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Listings section */}
        <section id="directory-results" aria-busy={loading} className="container-wide mt-6 scroll-mt-24">
          <p role="status" className="mb-4 text-sm text-white/75">{loading ? (locale === 'es' ? 'Buscando…' : 'Searching…') : loadError ? (locale === 'es' ? 'No se pudieron cargar los resultados.' : 'Results could not be loaded.') : `${listings.length ? page * 24 + 1 : 0}–${listings.length ? page * 24 + listings.length : 0} ${locale === 'es' ? 'de' : 'of'} ${pageInfo.total} ${locale === 'es' ? 'resultados' : 'results'}`}</p>
          {!loading && !loadError && pageInfo.visibilityChanged && <p className="mb-3 text-sm text-white/60">{locale === 'es' ? 'Algunas fichas cambiaron desde la última actualización de búsqueda.' : 'Some listings changed since the last search-index update.'}</p>}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-neon"></div>
              <p className="text-white/60 mt-4 font-medium">{locale === 'es' ? 'Cargando negocios…' : 'Loading listings…'}</p>
            </div>
          ) : loadError ? (
            <div role="alert" className="citybeat-panel rounded-2xl p-6 text-center"><p>{locale === 'es' ? 'Intenta de nuevo en unos momentos.' : 'Please try again in a moment.'}</p><button onClick={() => setRetry(n => n + 1)} className="mt-4 min-h-11 rounded bg-brand-neon px-5 font-bold text-black">{locale === 'es' ? 'Reintentar' : 'Retry'}</button></div>
          ) : listings.length === 0 ? (
            <div className="citybeat-panel rounded-2xl p-12 text-center max-w-lg mx-auto">
              <p className="text-white/70 text-lg">{t.noResults}</p>
              <button onClick={clearFilters} className="mt-4 min-h-11 rounded border border-brand-neon px-5 text-brand-neon">{locale === 'es' ? 'Quitar filtros' : 'Clear filters'}</button>
            </div>
          ) : (
            <div className="space-y-16">
              {/* Sponsored Listings Section */}
              <div>
                {sponsoredListings.length > 0 ? (
                  <div>
                    <h2 className="font-sans text-xl font-bold uppercase tracking-wider text-brand-gold mb-6 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-brand-gold animate-pulse" />
                      Sponsored Listings
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {sponsoredListings.map((listing) => (
                        <Link
                          key={listing.id}
                          href={`/${locale}/directory/${listing.id}`}
                          className="group relative rounded-2xl border-2 border-brand-gold bg-brand-ink/90 overflow-hidden shadow-[0_0_20px_rgba(255,215,0,0.06)] hover:shadow-[0_0_30px_rgba(255,215,0,0.18)] hover:border-brand-gold transition-all duration-300 flex flex-col min-h-[400px]"
                        >
                          <div className="absolute top-4 right-4 z-10 bg-brand-gold text-black font-black text-[9px] tracking-widest px-2.5 py-1 rounded">
                            ★ SPONSORED
                          </div>

                          <div className="relative h-48 w-full bg-brand-charcoal overflow-hidden">
                            <Image
                              src={listing.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60'}
                              alt={listing.name}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-transparent to-transparent" />
                          </div>

                          <div className="p-6 flex flex-col flex-grow">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded">
                                {categoryLabel(listing.category, locale)}
                              </span>
                            </div>

                            <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white mt-3 group-hover:text-brand-gold transition leading-snug">
                              {listing.name}
                              <LocationBadge count={listing.location_count} />
                            </h3>
                            <div className="mt-2"><PrintBadges value={listing.print_recognition} locale={locale} /></div>

                            {listing.rating && (
                              <div className="flex items-center gap-2 mt-2">
                                {renderStars(listing.rating)}
                                <span className="text-xs font-bold text-white/70">
                                  {listing.rating} ({listing.user_ratings_total} {t.reviews})
                                </span>
                              </div>
                            )}

                            <p className="mt-3 text-sm text-white/60 line-clamp-3 leading-relaxed flex-grow">
                              {listing.description || (locale === 'es' ? 'Consulta los datos de contacto, horarios e información de este negocio.' : 'View this business’s contact details, hours and information.')}
                            </p>

                            {listing.address && (
                              <p className="mt-4 text-xs text-white/40 flex items-center gap-1.5 border-t border-white/5 pt-4">
                                <svg className="h-4.5 w-4.5 text-brand-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{cleanListingText(listing.address)}</span>
                              </p>
                            )}

                            <div className="mt-5 pt-1">
                              <span className="w-full text-center block rounded bg-brand-gold group-hover:bg-yellow-400 text-black font-bold uppercase tracking-wider text-xs py-2.5 transition shadow-[0_4px_12px_rgba(255,215,0,0.2)]">
                                {t.viewDetails}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null
                }
              </div>

              {/* Premium Listings Section */}
              {premiumListings.length > 0 && (
                <div>
                  <h2 className="font-sans text-xl font-bold uppercase tracking-wider text-brand-neon flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-neon animate-pulse" />
                    {t.premiumTitle}
                  </h2>
                  <p className="mb-6 mt-2 max-w-3xl text-sm leading-relaxed text-white/55">{t.premiumExplainer}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {premiumListings.map((listing) => (
                      <Link
                        key={listing.id}
                        href={`/${locale}/directory/${listing.id}`}
                        className="group relative rounded-2xl border border-brand-neon bg-brand-ink/90 overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.06)] hover:shadow-[0_0_30px_rgba(0,240,255,0.18)] hover:border-brand-magenta transition-all duration-300 flex flex-col min-h-[400px]"
                      >
                        {/* Glow tag header */}
                        <div className="absolute top-4 right-4 z-10 bg-brand-neon text-black font-black text-[9px] tracking-widest px-2.5 py-1 rounded">
                          {t.premiumGlowText}
                        </div>

                        {/* Banner Image */}
                        <div className="relative h-48 w-full bg-brand-charcoal overflow-hidden">
                          <Image
                            src={listing.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60'}
                            alt={listing.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-transparent to-transparent" />
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded">
                              {categoryLabel(listing.category, locale)}
                            </span>
                          </div>

                          {/* Changed to clean, highly legible font-sans with tracking-tight */}
                          <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white mt-3 group-hover:text-brand-neon transition leading-snug">
                            {listing.name}
                            <LocationBadge count={listing.location_count} />
                          </h3>
                          <div className="mt-2"><PrintBadges value={listing.print_recognition} locale={locale} /></div>

                          {listing.rating && (
                            <div className="flex items-center gap-2 mt-2">
                              {renderStars(listing.rating)}
                              <span className="text-xs font-bold text-white/70">
                                {listing.rating} ({listing.user_ratings_total} {t.reviews})
                              </span>
                            </div>
                          )}

                          <p className="mt-3 text-sm text-white/60 line-clamp-3 leading-relaxed flex-grow">
                            {listing.description || (locale === 'es' ? 'Consulta los datos de contacto, horarios e información de este negocio.' : 'View this business’s contact details, hours and information.')}
                          </p>

                          {listing.address && (
                            <p className="mt-4 text-xs text-white/40 flex items-center gap-1.5 border-t border-white/5 pt-4">
                              <svg className="h-4.5 w-4.5 text-brand-neon flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{cleanListingText(listing.address)}</span>
                            </p>
                          )}

                          <div className="mt-5 pt-1">
                            <span className="w-full text-center block rounded bg-brand-neon group-hover:bg-cyan-300 text-black font-bold uppercase tracking-wider text-xs py-2.5 transition shadow-[0_4px_12px_rgba(0,240,255,0.2)]">
                              {t.viewDetails}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Listings Section */}
              {basicListings.length > 0 && (
                <div>
                  <h2 className="font-sans text-xl font-bold uppercase tracking-wider text-white/55">
                    {t.basicTitle}
                  </h2>
                  <p className="mb-6 mt-2 max-w-3xl text-sm leading-relaxed text-white/45">{t.basicExplainer}</p>
                  {/* Smaller, simpler boxes: grid layout with tight spacing and smaller elements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {basicListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="citybeat-panel rounded-xl p-4.5 border border-white/10 hover:border-white/15 transition-all flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                {categoryLabel(listing.category, locale)}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-wider text-white/55 border border-white/15 px-1.5 py-0.5 rounded bg-white/[0.03]">
                                {t.basicPlanLabel}
                              </span>
                            </div>
                            {listing.claim_status === 'unclaimed' ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold border border-brand-gold/20 px-1.5 py-0.5 rounded bg-brand-gold/5">
                                {t.claimBadge}
                              </span>
                            ) : listing.claim_status === 'approved' ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-neon border border-brand-neon/25 px-1.5 py-0.5 rounded bg-brand-neon/10">
                                {t.approvedBadge}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                                {t.pendingBadge}
                              </span>
                            )}
                          </div>

                          {/* Highly legible font-sans with clean styling */}
                          <h3 className="font-sans text-base font-bold tracking-normal text-white mt-2.5 leading-snug">
                            <Link href={`/${locale}/directory/${listing.id}`} className="hover:text-brand-neon underline-offset-4 hover:underline">{listing.name}</Link>
                            <LocationBadge count={listing.location_count} />
                          </h3>
                          <div className="mt-2"><PrintBadges value={listing.print_recognition} locale={locale} /></div>

                          {listing.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              {renderStars(listing.rating)}
                              <span className="text-[10px] text-white/50 font-bold">
                                {listing.rating}
                              </span>
                            </div>
                          )}

                          <p className="text-[11px] text-white/50 mt-2 line-clamp-1 leading-relaxed">
                            {cleanListingText(listing.address)}
                          </p>
                        </div>

                        <Link href={`/${locale}/directory/${listing.id}`} className="mt-4 flex min-h-11 items-center justify-center rounded bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20">{t.viewDetails}</Link>
                        {/* Owner action remains secondary. */}
                        {listing.claim_status === 'unclaimed' && (
                          <div className="mt-4 pt-3 border-t border-white/5">
                            <Link
                              href={`/${locale}/directory/${listing.id}/claim`}
                              className="flex min-h-[40px] w-full items-center justify-center rounded bg-brand-neon hover:bg-cyan-300 text-black font-extrabold uppercase tracking-wider text-[11px] py-2.5 transition"
                            >
                              {t.claimBtn}
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <nav aria-label={locale === 'es' ? 'Páginas de resultados' : 'Result pages'} className="container-wide my-6 flex flex-wrap gap-3">
          {!loadError && page > 0 && <button disabled={loading} onClick={() => changePage(page - 1)} className="min-h-11 rounded border border-white/30 px-5">{locale === 'es' ? 'Anterior' : 'Previous'}</button>}
          {!loadError && pageInfo.pageCount > 0 && <span className="flex min-h-11 items-center text-sm text-white/70">{locale === 'es' ? 'Página' : 'Page'} {page + 1} / {pageInfo.pageCount}</span>}
          {!loadError && pageInfo.hasMore && <button disabled={loading} onClick={() => changePage(page + 1)} className="min-h-11 rounded bg-brand-neon px-5 font-bold text-black">{locale === 'es' ? 'Siguiente' : 'Next'}</button>}
        </nav>
        {/* Server-rendered "browse by category & city" internal links (passed
            from the server page). In the initial SSR HTML — crawlable, keyword-
            rich, and feeds PageRank to the /best money pages + listing details. */}
        <div className="container-wide my-8 flex flex-wrap items-center justify-between gap-4 text-sm"><Link href={`/${locale}/premium`} className="text-brand-neon underline">{locale === 'es' ? '¿Tienes un negocio? Compara Básico gratis y Premium' : 'Own a business? Compare free Basic and Premium'}</Link><button type="button" onClick={() => setShowMap(!showMap)} className="min-h-11 rounded border border-white/20 px-4">{locale === 'es' ? 'Mostrar / ocultar mapa' : 'Show / hide map'}</button></div>
        {showMap && <section className="container-wide"><DirectoryMap listings={listings} locale={locale} /></section>}
        <div className="container-wide my-8"><AdBanner placement="directory" locale={locale} /></div>
        {browseLinks}
      </div>
    </CityBeatShell>
  )
}
