'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'
import BookmarkButton from '@/components/BookmarkButton'

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
  gallery_urls: string[] | null
  social_links: {
    facebook?: string
    instagram?: string
    twitter?: string
  } | null
  hours: Record<string, string> | null
  owner_id: string | null
}

interface UserProfile {
  id: string
  email: string
  is_editor: boolean
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DIAS_SEMANA = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo'
}

const translations = {
  en: {
    backToDirectory: '← Back to Directory',
    ratingVal: 'rating',
    reviews: 'reviews',
    phone: 'Phone',
    website: 'Website',
    address: 'Address',
    hoursTitle: 'Opening Hours',
    claimHeader: 'Is this your business?',
    claimSub: 'Claim this listing and subscribe to Premium for $19/mo to unlock:',
    premiumFeature1: 'High-resolution banner cover image',
    premiumFeature2: 'Multi-image photo gallery carousel',
    premiumFeature3: 'Custom long-form rich description',
    premiumFeature4: 'Direct links to Instagram, Facebook & Twitter',
    premiumFeature5: 'Detailed hours of operation schedule',
    claimBtn: 'Claim Business & Upgrade',
    pendingClaim: 'This listing is claimed and pending editor approval.',
    pendingClaimSub: 'Our editors will verify your payment and activate your Premium listing shortly.',
    approvedClaim: 'Verified Local Partner',
    editListing: 'Edit Premium Content',
    editTitle: 'Edit Listing Details',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    descriptionLabel: 'Business Description',
    imageUrlLabel: 'Cover Image URL',
    galleryLabel: 'Gallery Image URLs (one per line)',
    socialFb: 'Facebook URL',
    socialIg: 'Instagram URL',
    socialTw: 'Twitter URL',
    claimSuccess: 'Claim payment successful!',
    claimSuccessSub: 'Your claim request has been submitted for review. An editor will approve it shortly.',
    claimCancelled: 'Payment was cancelled. You can try claiming again anytime.',
    mapsBtn: 'Open in Google Maps',
    appleMapsBtn: 'Open in Apple Maps',
    reviewsTitle: 'Customer Reviews',
    writeReview: 'Write a Review',
    ratingLabel: 'Your Rating',
    commentPlaceholder: 'Share your experience with this business...',
    submitReview: 'Submit Review',
    submittingReview: 'Submitting...',
    noReviews: 'No reviews yet. Be the first to leave a review!',
    logInToReview: 'Please sign in to leave a review.',
    loginToReviewBtn: 'Sign In to Review',
    successReview: 'Review submitted successfully!',
  },
  es: {
    backToDirectory: '← Volver al Directorio',
    ratingVal: 'calificación',
    reviews: 'reseñas',
    phone: 'Teléfono',
    website: 'Sitio Web',
    address: 'Dirección',
    hoursTitle: 'Horario de Atención',
    claimHeader: '¿Es este su negocio?',
    claimSub: 'Reclame este perfil y suscríbase a Premium por $19/mes para desbloquear:',
    premiumFeature1: 'Imagen de portada de alta resolución',
    premiumFeature2: 'Galería de fotos con múltiples imágenes',
    premiumFeature3: 'Descripción personalizada detallada',
    premiumFeature4: 'Enlaces directos a Instagram, Facebook y Twitter',
    premiumFeature5: 'Horario detallado de operaciones',
    claimBtn: 'Reclamar Negocio y Mejorar',
    pendingClaim: 'Este perfil está reclamado y pendiente de aprobación del editor.',
    pendingClaimSub: 'Nuestros editores verificarán su pago y activarán su perfil Premium en breve.',
    approvedClaim: 'Socio Local Verificado',
    editListing: 'Editar Contenido Premium',
    editTitle: 'Editar Detalles del Perfil',
    saveChanges: 'Guardar Cambios',
    saving: 'Guardando...',
    descriptionLabel: 'Descripción del Negocio',
    imageUrlLabel: 'URL de Imagen de Portada',
    galleryLabel: 'URLs de Imágenes de Galería (una por línea)',
    socialFb: 'Enlace de Facebook',
    socialIg: 'Enlace de Instagram',
    socialTw: 'Enlace de Twitter',
    claimSuccess: '¡Pago de reclamación exitoso!',
    claimSuccessSub: 'Su solicitud de reclamación ha sido enviada para revisión. Un editor la aprobá en breve.',
    claimCancelled: 'El pago fue cancelado. Puede intentar reclamar de nuevo en cualquier momento.',
    mapsBtn: 'Abrir en Google Maps',
    appleMapsBtn: 'Abrir en Apple Maps',
    reviewsTitle: 'Reseñas de Clientes',
    writeReview: 'Escribir una Reseña',
    ratingLabel: 'Tu Calificación',
    commentPlaceholder: 'Comparte tu experiencia con este negocio...',
    submitReview: 'Enviar Reseña',
    submittingReview: 'Enviando...',
    noReviews: 'Aún no hay reseñas. ¡Sé el primero en dejar una!',
    logInToReview: 'Inicia sesión para dejar una reseña.',
    loginToReviewBtn: 'Iniciar Sesión para Reseñar',
    successReview: '¡Reseña enviada con éxito!',
  }
}

export default function ListingDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = (useLocale() || 'en') as 'en' | 'es'
  const t = translations[locale] || translations.en

  const id = params.id as string

  const [listing, setListing] = useState<Listing | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit fields state
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [galleryInput, setGalleryInput] = useState('')
  const [facebook, setFacebook] = useState('')
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [hoursState, setHoursState] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')

  // Banners from searchParams
  const statusParam = searchParams.get('status')

  const isEditor = userProfile?.is_editor ?? false

  // Reviews state variables
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [userRating, setUserRating] = useState(5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [userComment, setUserComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true)
      const res = await fetch(`/api/directory/${id}/reviews`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews || [])
      }
    } catch (err) {
      console.error('Error fetching reviews:', err)
    } finally {
      setReviewsLoading(false)
    }
  }, [id])

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true)
        // Fetch listing
        const resListing = await fetch(`/api/directory/${id}`)
        if (resListing.ok) {
          const data = await resListing.json()
          const l = data.listing as Listing
          setListing(l)

          // Populate edit fields
          setDescription(l.description || '')
          setImageUrl(l.image_url || '')
          setGalleryInput(l.gallery_urls ? l.gallery_urls.join('\n') : '')
          setFacebook(l.social_links?.facebook || '')
          setInstagram(l.social_links?.instagram || '')
          setTwitter(l.social_links?.twitter || '')
          setName(l.name || '')
          setCategory(l.category || '')
          setAddress(l.address || '')
          setPhone(l.phone || '')
          setWebsite(l.website || '')
          
          const defaultHours: Record<string, string> = {}
          DAYS_OF_WEEK.forEach(day => {
            defaultHours[day] = l.hours?.[day] || '9:00 AM - 9:00 PM'
          })
          setHoursState(defaultHours)
        }

        // Fetch current user
        const resProfile = await fetch('/api/profile')
        if (resProfile.ok) {
          const data = await resProfile.json()
          setUserProfile(data.profile as UserProfile)
        }
      } catch (err) {
        console.error('Error fetching listing detail page data:', err)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDetails()
      fetchReviews()
    }
  }, [id, fetchReviews])

  // Redirect basic tier listings to claim page unless user is the owner or an editor/admin
  useEffect(() => {
    if (listing) {
      const isOwner = userProfile && listing.owner_id === userProfile.id && listing.claim_status === 'approved';
      if (listing.tier !== 'premium' && !isEditor && !isOwner) {
        router.replace(`/${locale}/directory/${listing.id}/claim`)
      }
    }
  }, [listing, userProfile, isEditor, locale, router])

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const isPremiumOrEditor = (listing?.tier === 'premium' || isEditor)
    try {
      const response = await fetch(`/api/directory/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          category,
          address,
          phone,
          website,
          description: isPremiumOrEditor ? description : undefined,
          image_url: isPremiumOrEditor ? imageUrl : undefined,
          gallery_urls: isPremiumOrEditor ? galleryInput.split('\n').map(u => u.trim()).filter(Boolean) : undefined,
          social_links: isPremiumOrEditor ? {
            facebook,
            instagram,
            twitter,
          } : undefined,
          hours: hoursState
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setListing(data.listing)
        setEditMode(false)
      } else {
        alert('Failed to save changes')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploadingPhotos(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/creator/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.url) {
            setUploadedPhotos(prev => [...prev, data.url])
          }
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to upload image')
        }
      }
    } catch (err) {
      console.error('Error uploading photos:', err)
      alert('An error occurred while uploading photos')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const removeUploadedPhoto = (indexToRemove: number) => {
    setUploadedPhotos(prev => prev.filter((_, index) => index !== indexToRemove))
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile) return
    setSubmittingReview(true)
    setReviewSuccess('')
    try {
      const response = await fetch(`/api/directory/${id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment,
          photo_urls: uploadedPhotos,
        }),
      })

      if (response.ok) {
        setReviewSuccess(t.successReview)
        setUserComment('')
        setUserRating(5)
        setUploadedPhotos([])
        // Refresh listing details to get the new rating/user_ratings_total
        const resListing = await fetch(`/api/directory/${id}`)
        if (resListing.ok) {
          const data = await resListing.json()
          setListing(data.listing)
        }
        // Refresh reviews
        await fetchReviews()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to submit review')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while submitting your review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return null
    const stars = []
    const floor = Math.floor(rating)
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <svg
          key={i}
          className={`h-5 w-5 ${i <= floor ? 'text-brand-gold fill-brand-gold' : 'text-gray-600'}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
  }

  if (loading) {
    return (
      <CityBeatShell locale={locale}>
        <div className="citybeat-app min-h-screen flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-neon"></div>
          <p className="text-white/60 mt-4 font-medium">Loading details...</p>
        </div>
      </CityBeatShell>
    )
  }

  if (!listing) {
    return (
      <CityBeatShell locale={locale}>
        <div className="citybeat-app min-h-screen flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-black uppercase text-brand-neon">Listing not found</h2>
          <Link href="/directory" className="mt-4 btn-primary">{t.backToDirectory}</Link>
        </div>
      </CityBeatShell>
    )
  }

  const isOwner = listing.owner_id === userProfile?.id && listing.claim_status === 'approved'
  const showEditButton = isOwner || isEditor
  const visitorPhotos = reviews.flatMap((rev) => rev.photo_urls || []).filter(Boolean)

  if (listing && listing.tier !== 'premium' && !isEditor && !isOwner) {
    return (
      <CityBeatShell locale={locale}>
        <div className="citybeat-app min-h-screen flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-neon"></div>
          <p className="text-white/60 mt-4 font-medium">Redirecting to claim page...</p>
        </div>
      </CityBeatShell>
    )
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + (listing.address || ''))}`
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(listing.name + ' ' + (listing.address || ''))}`

  return (
    <CityBeatShell locale={locale}>
      {listing && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: listing.name,
              image: listing.image_url ? [listing.image_url] : [],
              '@id': `https://citybeatmag.co/${locale}/directory/${listing.id}`,
              url: `https://citybeatmag.co/${locale}/directory/${listing.id}`,
              telephone: listing.phone,
              address: listing.address ? {
                '@type': 'PostalAddress',
                streetAddress: listing.address
              } : undefined,
              aggregateRating: listing.rating && listing.user_ratings_total ? {
                '@type': 'AggregateRating',
                ratingValue: listing.rating,
                reviewCount: listing.user_ratings_total
              } : undefined
            })
          }}
        />
      )}
      <div className="citybeat-app min-h-screen pb-24">
        {/* Navigation Breadcrumb */}
        <div className="container-wide pt-8 pb-4">
          <Link href="/directory" className="text-sm font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300 transition">
            {t.backToDirectory}
          </Link>
        </div>

        {/* Claim Payment Status Banners */}
        {statusParam === 'success' && (
          <div className="container-wide mb-6">
            <div className="bg-brand-neon/10 border border-brand-neon p-6 rounded-2xl flex items-start gap-4">
              <span className="h-10 w-10 rounded-full bg-brand-neon text-black flex items-center justify-center text-xl font-bold flex-shrink-0">✓</span>
              <div>
                <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">{t.claimSuccess}</h3>
                <p className="text-sm text-white/70 mt-1">{t.claimSuccessSub}</p>
              </div>
            </div>
          </div>
        )}

        {statusParam === 'cancel' && (
          <div className="container-wide mb-6">
            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-start gap-4">
              <span className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">!</span>
              <div>
                <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide">Claim Cancelled</h3>
                <p className="text-sm text-white/70 mt-1">{t.claimCancelled}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="container-wide mb-6 flex justify-between items-center">
          <BookmarkButton contentType="directory" contentId={id} />
          {showEditButton && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="px-5 py-2.5 rounded-md bg-brand-neon text-black font-black uppercase tracking-wider text-xs hover:bg-cyan-300 transition shadow-[0_4px_12px_rgba(0,240,255,0.3)]"
            >
              {t.editListing}
            </button>
          )}
        </div>

        {editMode ? (
          /* EDIT MODE VIEW */
          <div className="container-wide">
            <div className="citybeat-panel rounded-2xl p-8 max-w-3xl mx-auto border border-brand-neon">
              <h2 className="font-display text-2xl font-black text-white uppercase tracking-wider mb-6 pb-4 border-b border-white/10">
                {t.editTitle}
              </h2>
              <form onSubmit={handleSaveChanges} className="space-y-6">
                {/* Basic Details (Editable by all verified owners/editors) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-white/10">
                  <div className="sm:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-neon mb-4">Basic Information</h3>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition"
                    >
                      <option value="Restaurant">Restaurant</option>
                      <option value="Cafe">Cafe</option>
                      <option value="Coffee Shop">Coffee Shop</option>
                      <option value="Bar">Bar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 123 Main St, El Paso, TX"
                      className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. (915) 555-0199"
                      className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Premium Details (Locked for Basic Tier) */}
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">
                        {t.descriptionLabel}
                      </label>
                      {listing.tier !== 'premium' && !isEditor && (
                        <Link href={`/${locale}/directory/${listing.id}/claim`} className="text-[10px] font-black uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                          🔒 Premium Feature - Click to Unlock
                        </Link>
                      )}
                    </div>
                    <textarea
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={listing.tier !== 'premium' && !isEditor}
                      placeholder={listing.tier === 'premium' || isEditor ? "Provide a detailed description of your business..." : "Upgrade to Premium to write a rich custom description."}
                      className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">
                        {t.imageUrlLabel}
                      </label>
                      {listing.tier !== 'premium' && !isEditor && (
                        <Link href={`/directory/${listing.id}/claim`} className="text-[10px] font-black uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                          🔒 Premium Feature - Click to Unlock
                        </Link>
                      )}
                    </div>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      disabled={listing.tier !== 'premium' && !isEditor}
                      placeholder={listing.tier === 'premium' || isEditor ? "https://example.com/banner.jpg" : "Upgrade to Premium to upload a custom banner."}
                      className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">
                        {t.galleryLabel}
                      </label>
                      {listing.tier !== 'premium' && !isEditor && (
                        <Link href={`/directory/${listing.id}/claim`} className="text-[10px] font-black uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                          🔒 Premium Feature - Click to Unlock
                        </Link>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={galleryInput}
                      onChange={(e) => setGalleryInput(e.target.value)}
                      disabled={listing.tier !== 'premium' && !isEditor}
                      placeholder={listing.tier === 'premium' || isEditor ? "https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg" : "Upgrade to Premium to build a photo gallery."}
                      className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">
                        Social Media Links
                      </label>
                      {listing.tier !== 'premium' && !isEditor && (
                        <Link href={`/directory/${listing.id}/claim`} className="text-[10px] font-black uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                          🔒 Premium Feature - Click to Unlock
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">
                          {t.socialFb}
                        </label>
                        <input
                          type="text"
                          value={facebook}
                          onChange={(e) => setFacebook(e.target.value)}
                          disabled={listing.tier !== 'premium' && !isEditor}
                          placeholder={listing.tier === 'premium' || isEditor ? "https://facebook.com/yourpage" : "Locked"}
                          className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">
                          {t.socialIg}
                        </label>
                        <input
                          type="text"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          disabled={listing.tier !== 'premium' && !isEditor}
                          placeholder={listing.tier === 'premium' || isEditor ? "https://instagram.com/yourpage" : "Locked"}
                          className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">
                          {t.socialTw}
                        </label>
                        <input
                          type="text"
                          value={twitter}
                          onChange={(e) => setTwitter(e.target.value)}
                          disabled={listing.tier !== 'premium' && !isEditor}
                          placeholder={listing.tier === 'premium' || isEditor ? "https://twitter.com/yourpage" : "Locked"}
                          className={`w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition ${listing.tier !== 'premium' && !isEditor ? 'opacity-40 cursor-not-allowed bg-white/5' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-neon mb-3">
                    {t.hoursTitle}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs text-white/70 w-24 flex-shrink-0">
                          {locale === 'es' ? DIAS_SEMANA[day as keyof typeof DIAS_SEMANA] : day}
                        </span>
                        <input
                          type="text"
                          value={hoursState[day] || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setHoursState(prev => ({ ...prev, [day]: val }))
                          }}
                          placeholder="e.g. 9:00 AM - 9:00 PM"
                          className="flex-grow rounded-md p-2 border border-white/15 bg-black/40 text-white text-xs focus:border-brand-neon focus:outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs hover:bg-cyan-300 transition"
                  >
                    {saving ? t.saving : t.saveChanges}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-6 py-3 rounded border border-white/20 text-white font-bold uppercase tracking-wider text-xs hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : listing.tier === 'premium' ? (
          /* PREMIUM VIEW DETAIL LAYOUT */
          <div>
            {/* High-res Premium Banner Cover */}
            <div className="relative h-[420px] w-full bg-brand-charcoal overflow-hidden border-b border-brand-neon/30">
              <Image
                src={listing.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=80'}
                alt={listing.name}
                fill
                priority
                className="object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/40 to-transparent" />
              
              {/* Floating Verified Badge */}
              <div className="absolute bottom-12 container-wide left-4 right-4 z-10">
                <div className="inline-flex items-center gap-2 bg-brand-neon text-black font-black text-xs tracking-widest px-3 py-1.5 rounded-full mb-4">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M2.166 4.9L10 1.154l7.834 3.746v5.82c0 5.626-4.524 9.176-7.834 10.026C6.69 19.896 2.166 16.346 2.166 10.72V4.9zm8.966 4.7a1 1 0 10-2 0v3a1 1 0 102 0v-3zm-1-4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {t.approvedClaim}
                </div>
                <h1 className="font-display text-4xl sm:text-6xl font-black text-white uppercase leading-none">
                  {listing.name}
                </h1>
                
                {listing.rating && (
                  <div className="flex items-center gap-3 mt-4">
                    {renderStars(listing.rating)}
                    <span className="text-sm font-bold text-white">
                      {listing.rating} ({listing.user_ratings_total} {t.reviews})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Info Blocks */}
            <div className="container-wide mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Description & Gallery */}
              <div className="lg:col-span-2 space-y-8">
                <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
                  <span className="text-xs font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 px-2.5 py-1 rounded">
                    {listing.category}
                  </span>
                  <h2 className="font-display text-2xl font-black uppercase text-white tracking-wide mt-4 mb-4">
                    About The Business
                  </h2>
                  <p className="text-white/70 text-lg leading-relaxed whitespace-pre-line">
                    {listing.description || (locale === 'es' 
                      ? 'Este socio verificado ofrece los mejores platos y servicios locales. Ven a disfrutar de una atmósfera de primer nivel con una rica historia y un personal acogedor.'
                      : 'This verified partner provides El Paso with premium culinary, beverage, or coffee options. Come experience a high-end local favorite with a welcoming atmosphere and rich history.')}
                  </p>

                  {/* Social media links */}
                  {listing.social_links && Object.values(listing.social_links).some(Boolean) && (
                    <div className="mt-8 pt-6 border-t border-white/5 flex gap-4">
                      {listing.social_links.instagram && (
                        <a href={listing.social_links.instagram} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-brand-charcoal text-white hover:text-brand-neon hover:bg-brand-neon/10 transition">
                          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948-.2-4.358-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                          </svg>
                        </a>
                      )}
                      {listing.social_links.facebook && (
                        <a href={listing.social_links.facebook} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-brand-charcoal text-white hover:text-brand-neon hover:bg-brand-neon/10 transition">
                          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                        </a>
                      )}
                      {listing.social_links.twitter && (
                        <a href={listing.social_links.twitter} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-full bg-brand-charcoal text-white hover:text-brand-neon hover:bg-brand-neon/10 transition">
                          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Gallery */}
                {listing.gallery_urls && listing.gallery_urls.length > 0 && (
                  <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
                    <h2 className="font-display text-2xl font-black uppercase text-white tracking-wide mb-6">
                      Photo Gallery
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {listing.gallery_urls.map((url, i) => (
                        <div key={i} className="relative h-60 rounded-lg overflow-hidden bg-brand-charcoal">
                          <Image
                            src={url}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visitor Photos Grid */}
                {visitorPhotos.length > 0 && (
                  <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
                    <h2 className="font-display text-2xl font-black uppercase text-white tracking-wide mb-6 flex items-center gap-2">
                      <span>Visitor Photos</span>
                      <span className="text-xs bg-brand-neon/15 text-brand-neon px-2.5 py-0.5 rounded-full font-bold">
                        {visitorPhotos.length}
                      </span>
                    </h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {visitorPhotos.map((url, i) => (
                        <div key={i} className="relative h-20 sm:h-24 rounded-lg overflow-hidden bg-brand-charcoal border border-white/10 cursor-pointer hover:opacity-80 transition group">
                          <Image
                            src={url}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 33vw, 15vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            onClick={() => window.open(url, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews Section */}
                <div className="citybeat-panel rounded-2xl p-8 border border-white/10 space-y-8">
                  <div>
                    <h2 className="font-display text-2xl font-black uppercase text-white tracking-wide mb-6">
                      {t.reviewsTitle}
                    </h2>
                    
                    {reviewsLoading ? (
                      <div className="flex items-center gap-2 text-white/50 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-neon"></div>
                        <span>Loading reviews...</span>
                      </div>
                    ) : reviews.length === 0 ? (
                      <p className="text-white/60 text-sm italic">{t.noReviews}</p>
                    ) : (
                      <div className="space-y-6">
                        {reviews.map((rev) => {
                          const reviewerName = rev.profiles?.full_name || rev.profiles?.email || 'Anonymous'
                          const avatarInitials = reviewerName.substring(0, 2).toUpperCase()
                          return (
                            <div key={rev.id} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
                              <div className="flex items-start gap-4">
                                {rev.profiles?.avatar_url ? (
                                  <div className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-brand-charcoal">
                                    <Image
                                      src={rev.profiles.avatar_url}
                                      alt={reviewerName}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center font-bold text-brand-neon text-sm flex-shrink-0">
                                    {avatarInitials}
                                  </div>
                                )}
                                <div className="flex-grow">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="font-bold text-white text-sm">{reviewerName}</h4>
                                    <span className="text-[10px] text-white/40">
                                      {new Date(rev.created_at).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center mt-1">
                                    {renderStars(rev.rating)}
                                  </div>
                                  {rev.comment && (
                                    <p className="text-white/70 text-sm mt-2.5 leading-relaxed whitespace-pre-line">
                                      {rev.comment}
                                    </p>
                                  )}
                                  {rev.photo_urls && rev.photo_urls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3.5">
                                      {rev.photo_urls.map((photoUrl: string, idx: number) => (
                                        <div key={idx} className="relative h-16 w-16 rounded overflow-hidden border border-white/10 bg-brand-charcoal cursor-pointer hover:opacity-80 transition flex-shrink-0">
                                          <Image
                                            src={photoUrl}
                                            alt=""
                                            fill
                                            sizes="64px"
                                            className="object-cover"
                                            onClick={() => window.open(photoUrl, '_blank')}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Leave a Review Form */}
                  <div className="pt-6 border-t border-white/5">
                    <h3 className="font-display text-xl font-bold uppercase text-white tracking-wide mb-4">
                      {t.writeReview}
                    </h3>

                    {userProfile ? (
                      <form onSubmit={handleSubmitReview} className="space-y-4">
                        {reviewSuccess && (
                          <div className="p-3 bg-brand-neon/10 border border-brand-neon/30 text-brand-neon rounded-md text-xs font-bold">
                            {reviewSuccess}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon mb-2">
                            {t.ratingLabel}
                          </label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const active = hoverRating !== null ? star <= hoverRating : star <= userRating
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setUserRating(star)}
                                  onMouseEnter={() => setHoverRating(star)}
                                  onMouseLeave={() => setHoverRating(null)}
                                  className="p-1 focus:outline-none transition-transform active:scale-95"
                                >
                                  <svg
                                    className={`h-7 w-7 ${active ? 'text-brand-gold fill-brand-gold' : 'text-white/20'}`}
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <textarea
                            rows={4}
                            value={userComment}
                            onChange={(e) => setUserComment(e.target.value)}
                            placeholder={t.commentPlaceholder}
                            className="w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none text-sm transition"
                          />
                        </div>

                        {/* Review Image Upload Area */}
                        <div className="space-y-3">
                          <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">
                            Add Photos (optional)
                          </label>
                          <div className="flex flex-wrap gap-3 items-center">
                            {uploadedPhotos.map((photoUrl, idx) => (
                              <div key={idx} className="relative h-20 w-20 rounded border border-white/20 overflow-hidden bg-brand-charcoal group">
                                <Image
                                  src={photoUrl}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeUploadedPhoto(idx)}
                                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <label className={`h-20 w-20 rounded border border-dashed border-white/20 hover:border-brand-neon cursor-pointer flex flex-col items-center justify-center gap-1 transition ${uploadingPhotos ? 'pointer-events-none opacity-50 bg-white/5' : 'hover:bg-white/5 bg-black/20'}`}>
                              <span className="text-white/60 text-lg font-bold">{uploadingPhotos ? '...' : '+'}</span>
                              <span className="text-[10px] text-white/50">{uploadingPhotos ? 'Uploading' : 'Upload'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-5 py-2.5 rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs hover:bg-cyan-300 transition shadow-[0_4px_12px_rgba(0,240,255,0.2)] disabled:opacity-50"
                        >
                          {submittingReview ? t.submittingReview : t.submitReview}
                        </button>
                      </form>
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                        <p className="text-sm text-white/70 mb-4">{t.logInToReview}</p>
                        <Link
                          href={`/${locale}/login?redirectTo=/directory/${id}`}
                          className="inline-block rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs px-5 py-2.5 hover:bg-cyan-300 transition"
                        >
                          {t.loginToReviewBtn}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Contact info & Hours */}
              <div className="space-y-8">
                {/* Contact Panel */}
                <div className="citybeat-panel rounded-2xl p-6 border border-white/10 space-y-4">
                  <h3 className="font-display text-xl font-bold uppercase border-b border-white/5 pb-3">Contact Details</h3>
                  
                  {listing.address && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-neon">{t.address}</p>
                      <p className="text-sm mt-1 text-white/80">{listing.address}</p>
                    </div>
                  )}

                  {listing.phone && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-neon">{t.phone}</p>
                      <p className="text-sm mt-1 text-white/80">{listing.phone}</p>
                    </div>
                  )}

                  {listing.website && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-neon">{t.website}</p>
                      <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-sm mt-1 text-brand-neon hover:underline truncate block">
                        {listing.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5 space-y-2.5">
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="w-full text-center block rounded bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-2.5 transition">
                      {t.mapsBtn}
                    </a>
                    <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer" className="w-full text-center block rounded border border-white/20 hover:bg-white/5 text-white font-bold uppercase tracking-wider text-xs py-2.5 transition">
                      {t.appleMapsBtn}
                    </a>
                  </div>
                </div>

                {/* Hours Schedule */}
                {listing.hours && (
                  <div className="citybeat-panel rounded-2xl p-6 border border-white/10">
                    <h3 className="font-display text-xl font-bold uppercase border-b border-white/5 pb-3 mb-4">{t.hoursTitle}</h3>
                    <div className="space-y-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="flex justify-between text-xs py-1 border-b border-white/5">
                          <span className="font-bold text-white/70">
                            {locale === 'es' ? DIAS_SEMANA[day as keyof typeof DIAS_SEMANA] : day}
                          </span>
                          <span className="text-white/90 font-medium">
                            {listing.hours?.[day] || 'Closed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* BASIC VIEW LAYOUT WITH CLAIM BANNER */
          <div className="container-wide mt-6">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Basic Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="citybeat-panel rounded-2xl p-8 border border-white/10">
                  <span className="text-xs font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 px-2.5 py-1 rounded">
                    {listing.category}
                  </span>
                  
                  <h1 className="font-display text-4xl font-black text-white mt-4 uppercase leading-none">
                    {listing.name}
                  </h1>

                  {listing.rating && (
                    <div className="flex items-center gap-3 mt-4">
                      {renderStars(listing.rating)}
                      <span className="text-sm font-bold text-white/70">
                        {listing.rating} ({listing.user_ratings_total} {t.reviews})
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-white/5">
                    {listing.address && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{t.address}</h4>
                        <p className="text-white/80 mt-1 text-sm">{listing.address}</p>
                      </div>
                    )}
                    {listing.phone && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{t.phone}</h4>
                        <p className="text-white/80 mt-1 text-sm">{listing.phone}</p>
                      </div>
                    )}
                    {listing.website && (
                      <div className="sm:col-span-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{t.website}</h4>
                        <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-brand-neon hover:underline mt-1 text-sm block truncate">
                          {listing.website}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row gap-4">
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center block rounded bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-xs py-3 transition">
                      {t.mapsBtn}
                    </a>
                    <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center block rounded border border-white/20 hover:bg-white/5 text-white font-bold uppercase tracking-wider text-xs py-3 transition">
                      {t.appleMapsBtn}
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Column: Claim Upgrade Call to Action */}
              <div className="space-y-6">
                {listing.claim_status === 'pending_approval' ? (
                  <div className="bg-brand-neon/10 border border-brand-neon/40 rounded-2xl p-6 text-center">
                    <span className="h-12 w-12 rounded-full bg-brand-neon text-black flex items-center justify-center text-2xl font-bold mx-auto mb-4 font-display">i</span>
                    <h3 className="font-display text-xl font-bold uppercase text-white">{t.pendingClaim}</h3>
                    <p className="text-xs text-white/70 mt-3 leading-relaxed">
                      {t.pendingClaimSub}
                    </p>
                  </div>
                ) : (
                  <div className="citybeat-panel rounded-2xl p-6 border border-brand-gold/30 bg-gradient-to-br from-brand-charcoal to-brand-dark shadow-[0_0_20px_rgba(255,215,0,0.04)] text-center">
                    <h3 className="font-display text-2xl font-black uppercase text-brand-gold">
                      {t.claimHeader}
                    </h3>
                    <p className="text-xs text-white/70 mt-2 leading-relaxed">
                      {t.claimSub}
                    </p>

                    <ul className="text-left text-xs text-white/80 space-y-2.5 my-6 max-w-xs mx-auto">
                      <li className="flex items-center gap-2">
                        <span className="text-brand-neon font-black">✓</span>
                        {t.premiumFeature1}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-neon font-black">✓</span>
                        {t.premiumFeature2}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-neon font-black">✓</span>
                        {t.premiumFeature3}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-neon font-black">✓</span>
                        {t.premiumFeature4}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-neon font-black">✓</span>
                        {t.premiumFeature5}
                      </li>
                    </ul>

                    <Link
                      href={`/${locale}/directory/${listing.id}/claim`}
                      className="w-full text-center block rounded-md bg-brand-neon hover:bg-cyan-300 text-black font-black uppercase tracking-wider text-xs py-3.5 transition shadow-[0_4px_12px_rgba(0,240,255,0.25)]"
                    >
                      {t.claimBtn}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </CityBeatShell>
  )
}
