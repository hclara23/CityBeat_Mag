'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { DIRECTORY_CATEGORIES, categoryLabel } from '@/lib/categories'
import {
  ENTITLEMENT_COPY,
  type DirectoryEntitlements,
  type DirectoryPlanKey,
} from '@/lib/directory-entitlements'
import { profileCompleteness, localSeoScore, type ListingScore } from '@/lib/listing-scores'
import {
  MAX_POSTS,
  MAX_PRODUCTS,
  MAX_SERVICES,
  MAX_SPECIAL_HOURS,
  type ActionLinks,
  type ListingPost,
  type ListingServiceItem,
  type SpecialHour,
} from '@/lib/listing-content'
import {
  ActionLinksEditor,
  AttributesEditor,
  ItemsEditor,
  PostsEditor,
  ReviewsManager,
  SpecialHoursEditor,
  TeamManager,
} from './CmsModules'

type OwnerListing = {
  id: string
  name: string
  category: string
  address: string
  phone: string
  website: string
  description: string
  description_es: string
  image_url: string
  gallery_urls: string[]
  social_links: { facebook?: string; instagram?: string; twitter?: string } & Record<string, string | undefined>
  hours: Record<string, string>
  special_hours: SpecialHour[]
  services: ListingServiceItem[]
  products: ListingServiceItem[]
  posts: ListingPost[]
  attributes: string[]
  action_links: ActionLinks
  tier: string
  claim_status: string
  is_published: boolean
  rating: number | null
  user_ratings_total: number | null
}

type Props = {
  locale: 'en' | 'es'
  listing: OwnerListing
  entitlements: DirectoryEntitlements
  plan: DirectoryPlanKey
  isStaff: boolean
  isOwner: boolean
}

type SectionKey =
  | 'overview'
  | 'profile'
  | 'media'
  | 'hours'
  | 'services'
  | 'products'
  | 'posts'
  | 'reviews'
  | 'leads'
  | 'analytics'
  | 'team'
  | 'settings'

const SECTIONS: { key: SectionKey; en: string; es: string }[] = [
  { key: 'overview', en: 'Overview', es: 'Resumen' },
  { key: 'profile', en: 'Business Profile', es: 'Perfil del negocio' },
  { key: 'media', en: 'Media', es: 'Multimedia' },
  { key: 'hours', en: 'Hours', es: 'Horario' },
  { key: 'services', en: 'Services', es: 'Servicios' },
  { key: 'products', en: 'Products / Menu', es: 'Productos / Menú' },
  { key: 'posts', en: 'Posts & Offers', es: 'Publicaciones y ofertas' },
  { key: 'reviews', en: 'Reviews', es: 'Reseñas' },
  { key: 'leads', en: 'Leads & Messages', es: 'Clientes y mensajes' },
  { key: 'analytics', en: 'Analytics', es: 'Analíticas' },
  { key: 'team', en: 'Team & Access', es: 'Equipo y acceso' },
  { key: 'settings', en: 'Settings', es: 'Configuración' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_ES: Record<string, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
}

const PLAN_LABEL: Record<DirectoryPlanKey, string> = {
  basic: 'Basic',
  founders: 'Founders',
  premium: 'Premium',
  featured: 'Featured',
}

// Which entitlement gates each Overview checklist item. Core items (name, phone,
// hours, …) are ungated. Used so a Basic owner's locked-but-incomplete items are
// shown as "upgrade to unlock" rather than an un-actionable to-do.
const SCORE_ITEM_ENTITLEMENT: Partial<Record<string, keyof DirectoryEntitlements>> = {
  description: 'enhancedDescription',
  description_es: 'enhancedDescription',
  bilingual: 'enhancedDescription',
  image: 'enhancedDescription',
  gallery: 'enhancedDescription',
  social: 'socialLinks',
}

function scoreItemLocked(key: string, entitlements: DirectoryEntitlements, isStaff: boolean): boolean {
  if (isStaff) return false
  const ent = SCORE_ITEM_ENTITLEMENT[key]
  return ent ? !entitlements[ent] : false
}

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error'

const inputClass =
  'w-full rounded-md p-3 border border-white/15 bg-black/40 text-white focus:border-brand-neon focus:outline-none transition'
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-white/70 mb-2'

export function DirectoryOwnerCms({ locale, listing, entitlements, plan, isStaff, isOwner }: Props) {
  const isEs = locale === 'es'
  const [section, setSection] = useState<SectionKey>('overview')

  // Editable state, seeded from the server-loaded listing.
  const [name, setName] = useState(listing.name)
  const [category, setCategory] = useState(listing.category)
  const [address, setAddress] = useState(listing.address)
  const [phone, setPhone] = useState(listing.phone)
  const [website, setWebsite] = useState(listing.website)
  const [description, setDescription] = useState(listing.description)
  const [imageUrl, setImageUrl] = useState(listing.image_url)
  const [galleryText, setGalleryText] = useState((listing.gallery_urls || []).join('\n'))
  const [facebook, setFacebook] = useState(listing.social_links?.facebook || '')
  const [instagram, setInstagram] = useState(listing.social_links?.instagram || '')
  const [twitter, setTwitter] = useState(listing.social_links?.twitter || '')
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const h: Record<string, string> = {}
    DAYS.forEach((d) => (h[d] = listing.hours?.[d] || ''))
    return h
  })
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>(listing.special_hours || [])
  const [services, setServices] = useState<ListingServiceItem[]>(listing.services || [])
  const [products, setProducts] = useState<ListingServiceItem[]>(listing.products || [])
  const [posts, setPosts] = useState<ListingPost[]>(listing.posts || [])
  const [attributes, setAttributes] = useState<string[]>(listing.attributes || [])
  const [actionLinks, setActionLinks] = useState<ActionLinks>(listing.action_links || {})

  const [status, setStatus] = useState<SaveState>('saved')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  // Same gates the server enforces (directory-entitlements). Staff bypass the
  // paid gates; the server re-checks, so these only drive the UI.
  const canPaid = isStaff || entitlements.enhancedDescription
  const canSocial = isStaff || entitlements.socialLinks
  const canServices = isStaff || entitlements.servicesAndProducts
  const canPosts = isStaff || entitlements.postsOffersEvents
  const canLinks = isStaff || entitlements.bookingLinks
  const canTeam = isStaff || entitlements.additionalManagers > 0

  const gallery = useMemo(
    () => galleryText.split('\n').map((u) => u.trim()).filter(Boolean),
    [galleryText]
  )

  const liveListing = useMemo(
    () => ({
      name,
      category,
      address,
      phone,
      website,
      description,
      description_es: listing.description_es,
      image_url: imageUrl,
      gallery_urls: gallery,
      social_links: { facebook, instagram, twitter },
      hours,
    }),
    [name, category, address, phone, website, description, imageUrl, gallery, facebook, instagram, twitter, hours, listing.description_es]
  )

  const completeness = profileCompleteness(liveListing)
  const seo = localSeoScore(liveListing)

  // The gallery is capped at the tier's media quota (mirrors the server). Staff
  // are not quota-capped.
  const galleryToSave = isStaff ? gallery : gallery.slice(0, entitlements.mediaLimit)
  const overGalleryLimit = !isStaff && gallery.length > entitlements.mediaLimit

  const fieldSig = JSON.stringify({
    name,
    category,
    address,
    phone,
    website,
    description: canPaid ? description : '',
    imageUrl: canPaid ? imageUrl : '',
    gallery: canPaid ? galleryToSave : [],
    social: canSocial ? { facebook, instagram, twitter } : {},
    hours,
    specialHours,
    services: canServices ? services : [],
    products: canServices ? products : [],
    attributes: canServices ? attributes : [],
    posts: canPosts ? posts : [],
    actionLinks: canLinks ? actionLinks : {},
  })
  const sigRef = useRef(fieldSig)
  sigRef.current = fieldSig
  const lastSavedSigRef = useRef(fieldSig) // baseline = server-seeded state
  const inFlightRef = useRef(false)

  // Current PATCH payload, kept in a ref so the single-flight save loop always
  // persists the latest values rather than a stale closure snapshot.
  const payloadRef = useRef<Record<string, unknown>>({})
  payloadRef.current = (() => {
    const p: Record<string, unknown> = { name, category, address, phone, website, hours, special_hours: specialHours }
    if (canPaid) {
      p.description = description
      p.image_url = imageUrl
      p.gallery_urls = galleryToSave
    }
    if (canSocial) p.social_links = { facebook, instagram, twitter }
    if (canServices) {
      p.services = services
      p.products = products
      p.attributes = attributes
    }
    if (canPosts) p.posts = posts
    if (canLinks) p.action_links = actionLinks
    return p
  })()

  // Single-flight autosave: never runs two PATCHes concurrently (prevents a
  // slower earlier write from clobbering a newer one), and loops until the
  // persisted state matches the latest edit so the indicator never sticks.
  const save = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const startSig = sigRef.current
        setStatus('saving')
        let ok = false
        try {
          const res = await fetch(`/api/directory/${listing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadRef.current),
          })
          ok = res.ok
        } catch {
          ok = false
        }
        if (!ok) {
          setStatus('error')
          break
        }
        lastSavedSigRef.current = startSig
        if (sigRef.current === startSig) {
          setStatus('saved')
          break
        }
        // Edits landed while saving — persist the newest before finishing.
      }
    } finally {
      inFlightRef.current = false
    }
  }

  // Debounced autosave. Skips while the form still matches the last-saved
  // baseline (which also makes the initial seed a no-op, robust to StrictMode's
  // double-invoked mount effect).
  useEffect(() => {
    if (fieldSig === lastSavedSigRef.current) return
    setStatus('unsaved')
    const t = setTimeout(() => {
      void save()
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldSig])

  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) return data.url as string
    alert(data.error || (isEs ? 'No se pudo subir la imagen' : 'Upload failed'))
    return null
  }

  const onCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
    const url = await uploadImage(file).finally(() => setUploadingCover(false))
    if (url) setImageUrl(url)
  }

  const onGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingGallery(true)
    try {
      const urls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImage(files[i])
        if (url) urls.push(url)
      }
      if (urls.length) setGalleryText((prev) => [prev.trim(), ...urls].filter(Boolean).join('\n'))
    } finally {
      setUploadingGallery(false)
    }
  }

  const publicUrl = `/${locale}/directory/${listing.id}`

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="border border-brand-neon/50 bg-brand-neon/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon">
                {PLAN_LABEL[plan]}
              </span>
              <ClaimStatusBadge status={listing.claim_status} isEs={isEs} />
              {isStaff && (
                <span className="border border-brand-magenta/50 bg-brand-magenta/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-magenta">
                  {isEs ? 'Acceso de personal' : 'Staff access'}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-black uppercase tracking-tight">
              {name || (isEs ? 'Ficha sin nombre' : 'Untitled listing')}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {isEs ? 'Panel de gestión de tu negocio' : 'Your business management dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SaveIndicator status={status} isEs={isEs} onRetry={() => void save()} />
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10"
            >
              {isEs ? 'Ver ficha pública ↗' : 'View public listing ↗'}
            </a>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Nav */}
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const active = s.key === section
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-bold transition ${
                    active
                      ? 'bg-brand-neon/15 text-brand-neon'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isEs ? s.es : s.en}
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="min-w-0">
            {section === 'overview' && (
              <OverviewSection
                isEs={isEs}
                completeness={completeness}
                seo={seo}
                plan={plan}
                entitlements={entitlements}
                isStaff={isStaff}
                publicUrl={publicUrl}
                onEditProfile={() => setSection('profile')}
              />
            )}

            {section === 'profile' && (
              <Panel title={isEs ? 'Perfil del negocio' : 'Business Profile'}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={isEs ? 'Nombre del negocio' : 'Business name'} className="sm:col-span-2">
                    <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label={isEs ? 'Categoría' : 'Category'}>
                    <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {category && !DIRECTORY_CATEGORIES.includes(category as any) && (
                        <option value={category}>{category}</option>
                      )}
                      {DIRECTORY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(c, locale)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={isEs ? 'Teléfono' : 'Phone number'}>
                    <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(915) 555-0199" />
                  </Field>
                  <Field label={isEs ? 'Dirección' : 'Address'} className="sm:col-span-2">
                    <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, El Paso, TX" />
                  </Field>
                  <Field label={isEs ? 'Sitio web' : 'Website'} className="sm:col-span-2">
                    <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
                  </Field>
                </div>

                <LockableField
                  unlocked={canPaid}
                  entitlementKey="enhancedDescription"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Descripción del negocio' : 'Business description'}
                >
                  <textarea
                    rows={6}
                    className={inputClass}
                    value={description}
                    disabled={!canPaid}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isEs ? 'Describe tu negocio para tus clientes…' : 'Describe your business for customers…'}
                  />
                  {canPaid && (
                    <p className="mt-2 text-xs text-white/40">
                      {isEs
                        ? '🌐 La traducción al español se genera automáticamente al guardar.'
                        : '🌐 The Spanish translation is generated automatically when you save.'}
                    </p>
                  )}
                </LockableField>

                <LockableField
                  unlocked={canSocial}
                  entitlementKey="socialLinks"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Redes sociales' : 'Social links'}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <input className={inputClass} value={facebook} disabled={!canSocial} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook URL" />
                    <input className={inputClass} value={instagram} disabled={!canSocial} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram URL" />
                    <input className={inputClass} value={twitter} disabled={!canSocial} onChange={(e) => setTwitter(e.target.value)} placeholder="X / Twitter URL" />
                  </div>
                </LockableField>

                <LockableField
                  unlocked={canServices}
                  entitlementKey="servicesAndProducts"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Características del negocio' : 'Business attributes'}
                >
                  <AttributesEditor selected={attributes} onChange={setAttributes} isEs={isEs} disabled={!canServices} />
                </LockableField>

                <LockableField
                  unlocked={canLinks}
                  entitlementKey="bookingLinks"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Enlaces de acción (reservar, pedir, cotizar)' : 'Action links (book, order, quote)'}
                >
                  <ActionLinksEditor links={actionLinks} onChange={setActionLinks} isEs={isEs} disabled={!canLinks} />
                </LockableField>
              </Panel>
            )}

            {section === 'media' && (
              <Panel title={isEs ? 'Multimedia' : 'Media'}>
                <LockableField
                  unlocked={canPaid}
                  entitlementKey="enhancedDescription"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Imagen de portada' : 'Cover image'}
                >
                  {canPaid && imageUrl && (
                    <div className="relative mb-3 h-40 w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {/* Free-form owner-supplied URL — a plain img avoids the next/image remote-host allowlist. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input className={inputClass} value={imageUrl} disabled={!canPaid} onChange={(e) => setImageUrl(e.target.value)} placeholder={isEs ? 'Pega una URL o sube una foto' : 'Paste a URL or upload a photo'} />
                  {canPaid && (
                    <label className={`mt-2 inline-flex cursor-pointer rounded-md bg-brand-neon/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-brand-neon ${uploadingCover ? 'pointer-events-none opacity-50' : ''}`}>
                      {uploadingCover ? (isEs ? 'Subiendo…' : 'Uploading…') : isEs ? '📷 Subir portada' : '📷 Upload cover'}
                      <input type="file" accept="image/*" className="hidden" onChange={onCoverUpload} disabled={uploadingCover} />
                    </label>
                  )}
                </LockableField>

                <LockableField
                  unlocked={canPaid}
                  entitlementKey="mediaLimit"
                  locale={locale}
                  listingId={listing.id}
                  label={isEs ? 'Galería de fotos (una URL por línea)' : 'Photo gallery (one URL per line)'}
                >
                  <textarea rows={5} className={inputClass} value={galleryText} disabled={!canPaid} onChange={(e) => setGalleryText(e.target.value)} placeholder={isEs ? 'Sube fotos con el botón de abajo' : 'Add photos with the button below'} />
                  {canPaid && (
                    <div className="mt-2 flex items-center gap-3">
                      <label className={`inline-flex cursor-pointer rounded-md bg-brand-neon/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black hover:bg-brand-neon ${uploadingGallery ? 'pointer-events-none opacity-50' : ''}`}>
                        {uploadingGallery ? (isEs ? 'Subiendo…' : 'Uploading…') : isEs ? '🖼️ Subir fotos' : '🖼️ Upload photos'}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={onGalleryUpload} disabled={uploadingGallery} />
                      </label>
                      {gallery.length > 0 && (
                        <span className="text-[10px] text-brand-neon">
                          {gallery.length}
                          {!isStaff ? ` / ${entitlements.mediaLimit}` : ''} {isEs ? 'foto(s)' : 'photo(s)'}
                        </span>
                      )}
                    </div>
                  )}
                  {overGalleryLimit && (
                    <p className="mt-2 text-[10px] font-bold text-amber-300">
                      {isEs
                        ? `Solo se guardarán las primeras ${entitlements.mediaLimit} fotos en tu plan.`
                        : `Only the first ${entitlements.mediaLimit} photos will be saved on your plan.`}
                    </p>
                  )}
                </LockableField>
              </Panel>
            )}

            {section === 'hours' && (
              <Panel title={isEs ? 'Horario de atención' : 'Opening hours'}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-24 flex-shrink-0 text-xs text-white/70">{isEs ? DAYS_ES[day] : day}</span>
                      <input
                        className={`${inputClass} text-xs`}
                        value={hours[day] || ''}
                        onChange={(e) => setHours((prev) => ({ ...prev, [day]: e.target.value }))}
                        placeholder={isEs ? 'p. ej. 9:00 AM - 9:00 PM' : 'e.g. 9:00 AM - 9:00 PM'}
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-5">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-neon">
                    {isEs ? 'Horario especial y cierres' : 'Special hours & closures'}
                  </h3>
                  <SpecialHoursEditor rows={specialHours} onChange={setSpecialHours} isEs={isEs} max={MAX_SPECIAL_HOURS} />
                </div>
              </Panel>
            )}

            {section === 'services' && (
              <ModulePanel title={isEs ? 'Servicios' : 'Services'} isEs={isEs}>
                {canServices ? (
                  <ItemsEditor items={services} onChange={setServices} isEs={isEs} kind="service" max={MAX_SERVICES} />
                ) : (
                  <ModulePlaceholder entitlementKey="servicesAndProducts" entitled={false} locale={locale} listingId={listing.id} isEs={isEs} />
                )}
              </ModulePanel>
            )}
            {section === 'products' && (
              <ModulePanel title={isEs ? 'Productos / Menú' : 'Products / Menu'} isEs={isEs}>
                {canServices ? (
                  <ItemsEditor items={products} onChange={setProducts} isEs={isEs} kind="product" max={MAX_PRODUCTS} />
                ) : (
                  <ModulePlaceholder entitlementKey="servicesAndProducts" entitled={false} locale={locale} listingId={listing.id} isEs={isEs} />
                )}
              </ModulePanel>
            )}
            {section === 'posts' && (
              <ModulePanel title={isEs ? 'Publicaciones y ofertas' : 'Posts & Offers'} isEs={isEs}>
                {canPosts ? (
                  <PostsEditor posts={posts} onChange={setPosts} isEs={isEs} max={MAX_POSTS} />
                ) : (
                  <ModulePlaceholder entitlementKey="postsOffersEvents" entitled={false} locale={locale} listingId={listing.id} isEs={isEs} />
                )}
              </ModulePanel>
            )}
            {section === 'reviews' && (
              <Panel title={isEs ? 'Reseñas' : 'Reviews'}>
                <ReviewsManager listingId={listing.id} isEs={isEs} />
                <a href={`${publicUrl}#reviews`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10">
                  {isEs ? 'Ver en la ficha pública ↗' : 'View on the public listing ↗'}
                </a>
              </Panel>
            )}
            {section === 'leads' && (
              <ModulePanel title={isEs ? 'Clientes y mensajes' : 'Leads & Messages'} isEs={isEs}>
                <ModulePlaceholder entitlementKey="detailedLeads" entitled={isStaff || entitlements.detailedLeads} locale={locale} listingId={listing.id} isEs={isEs} />
              </ModulePanel>
            )}
            {section === 'analytics' && (
              <ModulePanel title={isEs ? 'Analíticas' : 'Analytics'} isEs={isEs}>
                <ModulePlaceholder entitlementKey="fullAnalytics" entitled={isStaff || entitlements.fullAnalytics} locale={locale} listingId={listing.id} isEs={isEs} />
              </ModulePanel>
            )}
            {section === 'team' && (
              <ModulePanel title={isEs ? 'Equipo y acceso' : 'Team & Access'} isEs={isEs}>
                {canTeam ? (
                  <TeamManager listingId={listing.id} isEs={isEs} isOwner={isOwner || isStaff} />
                ) : (
                  <ModulePlaceholder entitlementKey="additionalManagers" entitled={false} locale={locale} listingId={listing.id} isEs={isEs} />
                )}
              </ModulePanel>
            )}

            {section === 'settings' && (
              <Panel title={isEs ? 'Configuración' : 'Settings'}>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                    <dt className="text-white/50">{isEs ? 'Plan actual' : 'Current plan'}</dt>
                    <dd className="font-bold">{PLAN_LABEL[plan]}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                    <dt className="text-white/50">{isEs ? 'Estado' : 'Status'}</dt>
                    <dd className="font-bold">{claimStatusLabel(listing.claim_status, isEs)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/5 pb-3">
                    <dt className="text-white/50">{isEs ? 'URL pública' : 'Public URL'}</dt>
                    <dd className="truncate">
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-brand-neon hover:underline">
                        {publicUrl}
                      </a>
                    </dd>
                  </div>
                </dl>
                {plan !== 'featured' && (
                  <Link
                    href={`/${locale}/directory/${listing.id}/claim`}
                    className="mt-6 inline-flex rounded-md bg-brand-neon px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
                  >
                    {isEs ? 'Mejorar mi plan' : 'Upgrade my plan'}
                  </Link>
                )}
              </Panel>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

const CLAIM_STATUS: Record<string, { en: string; es: string; cls: string }> = {
  approved: { en: 'Verified', es: 'Verificado', cls: 'border-brand-neon/50 bg-brand-neon/10 text-brand-neon' },
  pending_approval: { en: 'Pending review', es: 'En revisión', cls: 'border-amber-400/50 bg-amber-400/10 text-amber-300' },
  unclaimed: { en: 'Unclaimed', es: 'Sin reclamar', cls: 'border-white/20 bg-white/5 text-white/60' },
}

function claimStatusLabel(status: string, isEs: boolean): string {
  const s = CLAIM_STATUS[status] || CLAIM_STATUS.unclaimed
  return isEs ? s.es : s.en
}

function ClaimStatusBadge({ status, isEs }: { status: string; isEs: boolean }) {
  const s = CLAIM_STATUS[status] || CLAIM_STATUS.unclaimed
  return (
    <span className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${s.cls}`}>
      {isEs ? s.es : s.en}
    </span>
  )
}

function SaveIndicator({ status, isEs, onRetry }: { status: SaveState; isEs: boolean; onRetry: () => void }) {
  if (status === 'saving') return <span className="text-xs font-bold text-white/50">{isEs ? 'Guardando…' : 'Saving…'}</span>
  if (status === 'unsaved') return <span className="text-xs font-bold text-amber-300">{isEs ? 'Cambios sin guardar…' : 'Unsaved changes…'}</span>
  if (status === 'error')
    return (
      <button type="button" onClick={onRetry} className="text-xs font-bold text-red-400 underline">
        {isEs ? 'No se pudo guardar — reintentar' : "Couldn't save — retry"}
      </button>
    )
  return <span className="text-xs font-bold text-brand-neon">{isEs ? '✓ Guardado' : '✓ Saved'}</span>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="mb-5 font-display text-xl font-black uppercase tracking-wide text-white">{title}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

function ModulePanel({ title, isEs, children }: { title: string; isEs: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-black uppercase tracking-wide text-white">{title}</h2>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{isEs ? 'Módulo' : 'Module'}</span>
      </div>
      {children}
    </section>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

// A field group that is either editable (unlocked) or shown as a grayed,
// non-interactive locked module with a one-line benefit and an upgrade action
// rendered OUTSIDE the disabled area (per the platform brief's locked-feature
// rules). No protected data is ever rendered — the inputs are the owner's own.
function LockableField({
  unlocked,
  entitlementKey,
  locale,
  listingId,
  label,
  children,
}: {
  unlocked: boolean
  entitlementKey: keyof DirectoryEntitlements
  locale: 'en' | 'es'
  listingId: string
  label: string
  children: React.ReactNode
}) {
  const isEs = locale === 'es'
  const copy = ENTITLEMENT_COPY[entitlementKey]?.[locale]
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-brand-neon">{label}</label>
        {!unlocked && (
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold">🔒 {isEs ? 'Premium' : 'Premium'}</span>
        )}
      </div>
      <div className={!unlocked ? 'pointer-events-none select-none opacity-40' : ''} aria-disabled={!unlocked}>
        {children}
      </div>
      {!unlocked && copy && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/60">{copy.benefit}</p>
          <Link
            href={`/${locale}/directory/${listingId}/claim`}
            className="rounded-md bg-brand-gold/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black hover:bg-brand-gold"
          >
            {isEs ? 'Desbloquear' : 'Unlock'}
          </Link>
        </div>
      )}
    </div>
  )
}

// A whole module the owner does not yet have (locked → upgrade) or that ships in
// a later release (entitled → coming soon). Renders a non-interactive skeleton
// preview with NO real data behind it, and keeps any upgrade action outside the
// disabled preview.
function ModulePlaceholder({
  entitlementKey,
  entitled,
  locale,
  listingId,
  isEs,
}: {
  entitlementKey: keyof DirectoryEntitlements
  entitled: boolean
  locale: 'en' | 'es'
  listingId: string
  isEs: boolean
}) {
  const copy = ENTITLEMENT_COPY[entitlementKey]?.[locale]
  return (
    <div>
      <div aria-hidden className={`pointer-events-none select-none space-y-3 ${entitled ? 'opacity-50' : 'opacity-25 blur-[1px]'}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-5">
        {entitled ? (
          <>
            <p className="text-xs font-black uppercase tracking-wider text-brand-neon">✨ {isEs ? 'Próximamente' : 'Coming soon'}</p>
            <p className="mt-1 text-sm text-white/70">
              {isEs
                ? 'Esta herramienta está incluida en tu plan y se activará en una próxima actualización.'
                : 'This tool is included in your plan and unlocks in an upcoming update.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-black uppercase tracking-wider text-brand-gold">🔒 {copy?.label}</p>
            <p className="mt-1 text-sm text-white/70">{copy?.benefit}</p>
            <Link
              href={`/${locale}/directory/${listingId}/claim`}
              className="mt-3 inline-flex rounded-md bg-brand-gold/90 px-4 py-2 text-xs font-black uppercase tracking-wider text-black hover:bg-brand-gold"
            >
              {isEs ? 'Mejorar para desbloquear' : 'Upgrade to unlock'}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-brand-neon' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  )
}

function ScoreCard({
  title,
  score,
  isEs,
  locked,
}: {
  title: string
  score: ListingScore
  isEs: boolean
  locked: (key: string) => boolean
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-3 flex items-end justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-white">{title}</h3>
        <span className="font-display text-2xl font-black text-brand-neon">{score.score}%</span>
      </div>
      <ScoreBar score={score.score} />
      <ul className="mt-4 space-y-1.5">
        {score.items.map((item) => {
          const isLocked = !item.done && locked(item.key)
          return (
            <li key={item.key} className="flex items-center gap-2 text-xs">
              <span className={item.done ? 'text-brand-neon' : isLocked ? 'text-brand-gold' : 'text-white/30'}>
                {item.done ? '✓' : isLocked ? '🔒' : '○'}
              </span>
              <span className={item.done ? 'text-white/70' : 'text-white/50'}>
                {isEs ? item.label_es : item.label}
                {isLocked && <span className="ml-1 text-brand-gold/70">({isEs ? 'mejora' : 'upgrade'})</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function OverviewSection({
  isEs,
  completeness,
  seo,
  plan,
  entitlements,
  isStaff,
  publicUrl,
  onEditProfile,
}: {
  isEs: boolean
  completeness: ListingScore
  seo: ListingScore
  plan: DirectoryPlanKey
  entitlements: DirectoryEntitlements
  isStaff: boolean
  publicUrl: string
  onEditProfile: () => void
}) {
  const locked = (key: string) => scoreItemLocked(key, entitlements, isStaff)
  const notDone = completeness.items.filter((i) => !i.done)
  const allRemainingLocked = notDone.length > 0 && notDone.every((i) => locked(i.key))

  const nudge =
    completeness.score >= 100
      ? isEs
        ? '¡Tu perfil está completo! Revisa tu ficha pública para ver cómo la ven tus clientes.'
        : 'Your profile is complete! Check your public listing to see how customers see it.'
      : allRemainingLocked
        ? isEs
          ? 'Ya completaste todo lo de tu plan. Mejora para desbloquear las demás mejoras de tu perfil.'
          : "You've completed everything on your plan. Upgrade to unlock the remaining profile improvements."
        : isEs
          ? 'Completa los elementos marcados arriba para que más clientes de El Paso te encuentren.'
          : 'Fill in the items marked above so more El Paso customers can find you.'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ScoreCard title={isEs ? 'Perfil completo' : 'Profile completeness'} score={completeness} isEs={isEs} locked={locked} />
        <ScoreCard title={isEs ? 'SEO local' : 'Local SEO'} score={seo} isEs={isEs} locked={locked} />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-white">{isEs ? 'Siguientes pasos' : 'Next steps'}</h3>
        <p className="text-sm text-white/60">{nudge}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onEditProfile} className="rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
            {isEs ? 'Editar perfil' : 'Edit profile'}
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10">
            {isEs ? 'Ver ficha pública ↗' : 'View public listing ↗'}
          </a>
        </div>
        {plan === 'basic' && (
          <p className="mt-4 text-xs text-white/40">
            {isEs ? 'Estás en el plan Basic. Mejora para desbloquear más herramientas.' : "You're on the Basic plan. Upgrade to unlock more tools."}
          </p>
        )}
      </div>
    </div>
  )
}
