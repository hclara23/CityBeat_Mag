// Pure scoring helpers for the owner CMS Overview: a profile-completeness score
// (is the listing filled out?) and a local-SEO score (is it optimized to rank in
// El Paso local search?). Both return an actionable, bilingual checklist so the
// Overview can show owners exactly what to improve next. Kept pure + tested so the
// numbers are trustworthy and reused by later steps (reports, upsell prompts).

export type ListingScoreItem = {
  key: string
  label: string
  label_es: string
  done: boolean
}

export type ListingScore = {
  score: number // 0–100
  completed: number
  total: number
  items: ListingScoreItem[]
}

export type ScoredListing = {
  name?: string | null
  category?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
  description?: string | null
  description_es?: string | null
  image_url?: string | null
  gallery_urls?: string[] | null
  social_links?: Record<string, string | null | undefined> | null
  hours?: Record<string, string | null | undefined> | null
}

function filled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function textLen(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0
}

function hasHours(hours: ScoredListing['hours']): boolean {
  return !!hours && Object.values(hours).some((v) => filled(v))
}

function hasAnySocial(social: ScoredListing['social_links']): boolean {
  return !!social && Object.values(social).some((v) => filled(v))
}

function galleryCount(urls: ScoredListing['gallery_urls']): number {
  return Array.isArray(urls) ? urls.filter((u) => filled(u)).length : 0
}

function toScore(items: ListingScoreItem[]): ListingScore {
  const completed = items.filter((i) => i.done).length
  const total = items.length
  return {
    score: total === 0 ? 0 : Math.round((completed / total) * 100),
    completed,
    total,
    items,
  }
}

// How complete is the listing? Every field an owner can fill in counts equally.
export function profileCompleteness(listing: ScoredListing | null | undefined): ListingScore {
  const l = listing || {}
  return toScore([
    { key: 'name', label: 'Business name', label_es: 'Nombre del negocio', done: filled(l.name) },
    { key: 'category', label: 'Category', label_es: 'Categoría', done: filled(l.category) },
    { key: 'address', label: 'Address', label_es: 'Dirección', done: filled(l.address) },
    { key: 'phone', label: 'Phone number', label_es: 'Teléfono', done: filled(l.phone) },
    { key: 'website', label: 'Website', label_es: 'Sitio web', done: filled(l.website) },
    { key: 'hours', label: 'Opening hours', label_es: 'Horario', done: hasHours(l.hours) },
    { key: 'description', label: 'Business description', label_es: 'Descripción', done: textLen(l.description) >= 40 },
    { key: 'description_es', label: 'Spanish description', label_es: 'Descripción en español', done: filled(l.description_es) },
    { key: 'image', label: 'Primary photo', label_es: 'Foto principal', done: filled(l.image_url) },
    { key: 'social', label: 'Social links', label_es: 'Redes sociales', done: hasAnySocial(l.social_links) },
  ])
}

// How well is the listing optimized for local search? Weighted toward the signals
// that actually move local ranking — complete NAP (name/address/phone), category,
// a substantial description, bilingual copy (El Paso is ~90% Spanish-speaking),
// hours, and imagery.
export function localSeoScore(listing: ScoredListing | null | undefined): ListingScore {
  const l = listing || {}
  return toScore([
    { key: 'name', label: 'Business name', label_es: 'Nombre del negocio', done: filled(l.name) },
    { key: 'category', label: 'Category set', label_es: 'Categoría definida', done: filled(l.category) },
    { key: 'address', label: 'Full local address', label_es: 'Dirección local completa', done: filled(l.address) },
    { key: 'phone', label: 'Phone number', label_es: 'Teléfono', done: filled(l.phone) },
    { key: 'website', label: 'Website link', label_es: 'Enlace al sitio web', done: filled(l.website) },
    { key: 'description', label: 'Detailed description (120+ chars)', label_es: 'Descripción detallada (120+ caracteres)', done: textLen(l.description) >= 120 },
    { key: 'bilingual', label: 'Bilingual (Spanish) description', label_es: 'Descripción bilingüe (español)', done: filled(l.description_es) },
    { key: 'hours', label: 'Opening hours', label_es: 'Horario de atención', done: hasHours(l.hours) },
    { key: 'image', label: 'Primary photo', label_es: 'Foto principal', done: filled(l.image_url) },
    { key: 'gallery', label: 'Photo gallery (3+)', label_es: 'Galería de fotos (3+)', done: galleryCount(l.gallery_urls) >= 3 },
  ])
}
