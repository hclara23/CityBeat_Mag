'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

interface Listing {
  id: string
  name: string
  description: string | null
  category: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  user_ratings_total: number | null
  tier: 'basic' | 'premium'
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
  image_url: string | null
}

const CATEGORIES = ['All', 'Restaurant', 'Cafe', 'Coffee Shop', 'Bar']

const translations = {
  en: {
    title: 'Local Business Directory',
    subtitle: 'Discover the best food, drinks, and coffee spots in El Paso, Las Cruces, and the borderlands.',
    searchPlaceholder: 'Search by name, category, address...',
    allCategories: 'All Categories',
    premiumTitle: 'Featured Premium Listings',
    basicTitle: 'Local Businesses',
    noResults: 'No businesses found matching your criteria.',
    ratingVal: 'rating',
    reviews: 'reviews',
    claimBadge: 'Unclaimed',
    pendingBadge: 'Pending Approval',
    approvedBadge: 'Verified Partner',
    claimBtn: 'Claim & Upgrade',
    viewDetails: 'View Details',
    premiumGlowText: 'PREMIUM PARTNER',
  },
  es: {
    title: 'Directorio de Negocios Locales',
    subtitle: 'Descubre los mejores restaurantes, cafés y bares en El Paso, Las Cruces y la frontera.',
    searchPlaceholder: 'Buscar por nombre, categoría, dirección...',
    allCategories: 'Todas las Categorías',
    premiumTitle: 'Negocios Premium Destacados',
    basicTitle: 'Negocios Locales',
    noResults: 'No se encontraron negocios con estos criterios.',
    ratingVal: 'calificación',
    reviews: 'reseñas',
    claimBadge: 'Sin Reclamar',
    pendingBadge: 'Pendiente de Aprobación',
    approvedBadge: 'Socio Verificado',
    claimBtn: 'Reclamar y Mejorar',
    viewDetails: 'Ver Detalles',
    premiumGlowText: 'SOCIO PREMIUM',
  }
}

export default function DirectoryPage() {
  const locale = useLocale() as 'en' | 'es'
  const t = translations[locale] || translations.en
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    const fetchListings = async () => {
      try {
        setLoading(true)
        const categoryParam = selectedCategory === 'All' ? '' : selectedCategory
        const response = await fetch(`/api/directory?query=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(categoryParam)}`)
        if (response.ok) {
          const data = await response.json()
          setListings(data.listings || [])
        }
      } catch (err) {
        console.error('Failed to load listings:', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchListings()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory])

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

  const premiumListings = listings.filter((l) => l.tier === 'premium')
  const basicListings = listings.filter((l) => l.tier !== 'premium')

  return (
    <CityBeatShell locale={locale}>
      <div className="citybeat-app min-h-screen pb-24">
        {/* Header Hero Area */}
        <section className="relative overflow-hidden py-20 citybeat-grid border-b border-white/10">
          <div className="container-wide relative z-10 text-center max-w-4xl">
            <h1 className="font-display text-5xl font-black tracking-tight text-white sm:text-6xl md:text-7xl uppercase leading-none">
              CITY<span className="text-brand-neon">BEAT</span> <span className="italic text-brand-magenta">DIRECTORY</span>
            </h1>
            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
              {t.subtitle}
            </p>

            {/* Search Input Box */}
            <div className="mt-8 max-w-xl mx-auto relative">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-full border border-white/15 bg-black/60 text-white font-medium focus:outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon transition"
              />
              <svg
                className="absolute left-4 top-4.5 h-6 w-6 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Category selection */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition ${
                      isActive
                        ? 'bg-brand-neon text-black font-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                        : 'border border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    {cat === 'All' ? (locale === 'es' ? 'Todos' : 'All') : cat}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Content Listings section */}
        <section className="container-wide mt-16">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-neon"></div>
              <p className="text-white/60 mt-4 font-medium">Loading listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="citybeat-panel rounded-2xl p-12 text-center max-w-lg mx-auto">
              <p className="text-white/70 text-lg">{t.noResults}</p>
            </div>
          ) : (
            <div className="space-y-16">
              {/* Premium Listings Section */}
              {premiumListings.length > 0 && (
                <div>
                  <h2 className="font-sans text-xl font-bold uppercase tracking-wider text-brand-neon mb-6 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-neon animate-pulse" />
                    {t.premiumTitle}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {premiumListings.map((listing) => (
                      <Link
                        key={listing.id}
                        href={`/directory/${listing.id}`}
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
                              {listing.category}
                            </span>
                          </div>

                          {/* Changed to clean, highly legible font-sans with tracking-tight */}
                          <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white mt-3 group-hover:text-brand-neon transition leading-snug">
                            {listing.name}
                          </h3>

                          {listing.rating && (
                            <div className="flex items-center gap-2 mt-2">
                              {renderStars(listing.rating)}
                              <span className="text-xs font-bold text-white/70">
                                {listing.rating} ({listing.user_ratings_total} {t.reviews})
                              </span>
                            </div>
                          )}

                          <p className="mt-3 text-sm text-white/60 line-clamp-3 leading-relaxed flex-grow">
                            {listing.description || (locale === 'es' ? 'Experiencia local única de primer nivel. Haz clic para conocer más detalles sobre el menú, los horarios de apertura y su historia.' : 'A top-tier local favorite. Click to learn more details about their menu, hours of operation, and story.')}
                          </p>

                          {listing.address && (
                            <p className="mt-4 text-xs text-white/40 flex items-center gap-1.5 border-t border-white/5 pt-4">
                              <svg className="h-4.5 w-4.5 text-brand-neon flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{listing.address}</span>
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
                  <h2 className="font-sans text-xl font-bold uppercase tracking-wider text-white/40 mb-6">
                    {t.basicTitle}
                  </h2>
                  {/* Smaller, simpler boxes: grid layout with tight spacing and smaller elements */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {basicListings.map((listing) => (
                      <div
                        key={listing.id}
                        className="citybeat-panel rounded-xl p-4.5 border border-white/10 hover:border-white/15 transition-all flex flex-col justify-between min-h-[160px]"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded">
                              {listing.category}
                            </span>
                            {listing.claim_status === 'unclaimed' ? (
                              <span className="text-[8px] font-bold uppercase tracking-widest text-brand-gold border border-brand-gold/20 px-1.5 py-0.5 rounded bg-brand-gold/5">
                                {t.claimBadge}
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                                {t.pendingBadge}
                              </span>
                            )}
                          </div>

                          {/* Highly legible font-sans with clean styling */}
                          <h3 className="font-sans text-base font-bold tracking-normal text-white mt-2.5 line-clamp-1 leading-snug">
                            {listing.name}
                          </h3>

                          {listing.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              {renderStars(listing.rating)}
                              <span className="text-[9px] text-white/50 font-bold">
                                {listing.rating}
                              </span>
                            </div>
                          )}

                          <p className="text-[11px] text-white/50 mt-2 line-clamp-1 leading-relaxed">
                            {listing.address}
                          </p>
                        </div>

                        {/* Direct claim button linking to claim redirect page */}
                        {listing.claim_status === 'unclaimed' && (
                          <div className="mt-4 pt-3 border-t border-white/5">
                            <Link
                              href={`/directory/${listing.id}/claim`}
                              className="w-full text-center block rounded bg-brand-neon hover:bg-cyan-300 text-black font-extrabold uppercase tracking-wider text-[9px] py-1.5 transition"
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
      </div>
    </CityBeatShell>
  )
}
