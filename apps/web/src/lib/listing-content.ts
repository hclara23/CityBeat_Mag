// Structured owner-CMS content for directory listings: services, products/menu,
// business attributes, posts/offers/events (with scheduling + expiration),
// booking/action links, and special hours. Pure sanitizers so the PATCH route
// can accept client JSON safely — every write is capped, trimmed, and shaped
// here before it reaches Firestore. All display copy is bilingual (EN/ES).

export const MAX_SERVICES = 30
export const MAX_PRODUCTS = 50
export const MAX_POSTS = 20
export const MAX_SPECIAL_HOURS = 20

export type ListingServiceItem = {
  id: string
  name: string
  name_es: string
  price_label: string
  description: string
  description_es: string
}

export type ListingPostType = 'update' | 'offer' | 'event'

export type ListingPost = {
  id: string
  type: ListingPostType
  title: string
  title_es: string
  body: string
  body_es: string
  starts_at: string | null // ISO date (YYYY-MM-DD) or null = immediately
  ends_at: string | null // ISO date or null = never expires
  cta_url: string | null
  created_at: string
}

export const ACTION_LINK_KEYS = ['booking', 'order', 'reservation', 'appointment', 'quote'] as const
export type ActionLinkKey = (typeof ACTION_LINK_KEYS)[number]
export type ActionLinks = Partial<Record<ActionLinkKey, string>>

export const ACTION_LINK_LABELS: Record<ActionLinkKey, { en: string; es: string }> = {
  booking: { en: 'Book now', es: 'Reservar' },
  order: { en: 'Order online', es: 'Pedir en línea' },
  reservation: { en: 'Reserve a table', es: 'Reservar mesa' },
  appointment: { en: 'Make an appointment', es: 'Agendar cita' },
  quote: { en: 'Request a quote', es: 'Pedir cotización' },
}

// Business attributes shown as badges on the public listing. Allow-listed keys
// only — free-text attributes are not accepted.
export const ATTRIBUTE_DEFS: { key: string; en: string; es: string }[] = [
  { key: 'wheelchair_accessible', en: 'Wheelchair accessible', es: 'Accesible en silla de ruedas' },
  { key: 'family_friendly', en: 'Family friendly', es: 'Para toda la familia' },
  { key: 'women_owned', en: 'Women-owned', es: 'Negocio de mujeres' },
  { key: 'veteran_owned', en: 'Veteran-owned', es: 'Negocio de veteranos' },
  { key: 'locally_owned', en: 'Locally owned', es: 'Negocio local' },
  { key: 'spanish_spoken', en: 'Se habla español', es: 'Se habla español' },
  { key: 'free_parking', en: 'Free parking', es: 'Estacionamiento gratis' },
  { key: 'free_wifi', en: 'Free Wi-Fi', es: 'Wi-Fi gratis' },
  { key: 'outdoor_seating', en: 'Outdoor seating', es: 'Área al aire libre' },
  { key: 'delivery', en: 'Delivery', es: 'Entrega a domicilio' },
  { key: 'takeout', en: 'Takeout', es: 'Para llevar' },
  { key: 'curbside_pickup', en: 'Curbside pickup', es: 'Recogida en la acera' },
  { key: 'pet_friendly', en: 'Pet friendly', es: 'Acepta mascotas' },
  { key: 'accepts_cards', en: 'Accepts cards', es: 'Acepta tarjetas' },
  { key: 'appointment_only', en: 'By appointment only', es: 'Solo con cita' },
  { key: 'open_late', en: 'Open late', es: 'Abierto hasta tarde' },
]

const ATTRIBUTE_KEYS = new Set(ATTRIBUTE_DEFS.map((a) => a.key))

export type SpecialHour = { date: string; hours: string }

// --- primitives ---

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanId(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : ''
  return /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : fallback
}

// Only http(s) URLs, bounded length. Anything else → null (dropped).
export function sanitizeHttpUrl(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v || v.length > 300) return null
  try {
    const url = new URL(v)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

// ISO calendar date (YYYY-MM-DD) or null.
function sanitizeDate(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return Number.isFinite(Date.parse(v)) ? v : null
}

// --- services & products (same shape) ---

function sanitizeServiceLike(input: unknown, cap: number, prefix: string): ListingServiceItem[] {
  if (!Array.isArray(input)) return []
  const out: ListingServiceItem[] = []
  for (let i = 0; i < input.length && out.length < cap; i++) {
    const raw = input[i] as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') continue
    const name = str(raw.name, 120)
    if (!name) continue // a name is the minimum viable entry
    out.push({
      id: cleanId(raw.id, `${prefix}-${i}`),
      name,
      name_es: str(raw.name_es, 120),
      price_label: str(raw.price_label, 40),
      description: str(raw.description, 400),
      description_es: str(raw.description_es, 400),
    })
  }
  return out
}

export function sanitizeServices(input: unknown): ListingServiceItem[] {
  return sanitizeServiceLike(input, MAX_SERVICES, 'svc')
}

export function sanitizeProducts(input: unknown): ListingServiceItem[] {
  return sanitizeServiceLike(input, MAX_PRODUCTS, 'prod')
}

// --- posts / offers / events ---

export function sanitizePosts(input: unknown, now = new Date()): ListingPost[] {
  if (!Array.isArray(input)) return []
  const nowIso = now.toISOString()
  const out: ListingPost[] = []
  for (let i = 0; i < input.length && out.length < MAX_POSTS; i++) {
    const raw = input[i] as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') continue
    const title = str(raw.title, 140)
    if (!title) continue
    const type: ListingPostType =
      raw.type === 'offer' ? 'offer' : raw.type === 'event' ? 'event' : 'update'
    const createdAt = typeof raw.created_at === 'string' && Number.isFinite(Date.parse(raw.created_at))
      ? raw.created_at
      : nowIso
    out.push({
      id: cleanId(raw.id, `post-${i}`),
      type,
      title,
      title_es: str(raw.title_es, 140),
      body: str(raw.body, 1000),
      body_es: str(raw.body_es, 1000),
      starts_at: sanitizeDate(raw.starts_at),
      ends_at: sanitizeDate(raw.ends_at),
      cta_url: sanitizeHttpUrl(raw.cta_url),
      created_at: createdAt,
    })
  }
  return out
}

export type PostStatus = 'active' | 'scheduled' | 'expired'

export function postStatus(post: Pick<ListingPost, 'starts_at' | 'ends_at'>, nowMs: number): PostStatus {
  // A date-only starts_at begins at 00:00 UTC that day; ends_at lasts through
  // the END of its day so "ends 2026-08-01" includes August 1.
  if (post.starts_at && nowMs < Date.parse(post.starts_at)) return 'scheduled'
  if (post.ends_at && nowMs > Date.parse(post.ends_at) + 24 * 60 * 60 * 1000 - 1) return 'expired'
  return 'active'
}

// Public rendering: only currently-active posts, newest first.
export function activePosts(posts: unknown, nowMs: number): ListingPost[] {
  if (!Array.isArray(posts)) return []
  return (posts as ListingPost[])
    .filter((p) => p && typeof p === 'object' && p.title && postStatus(p, nowMs) === 'active')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

// --- action links ---

export function sanitizeActionLinks(input: unknown): ActionLinks {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: ActionLinks = {}
  for (const key of ACTION_LINK_KEYS) {
    const url = sanitizeHttpUrl((input as Record<string, unknown>)[key])
    if (url) out[key] = url
  }
  return out
}

// --- attributes ---

export function sanitizeAttributes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const value of input) {
    if (typeof value === 'string' && ATTRIBUTE_KEYS.has(value) && !out.includes(value)) {
      out.push(value)
    }
  }
  return out
}

export function attributeLabel(key: string, locale: 'en' | 'es'): string {
  const def = ATTRIBUTE_DEFS.find((a) => a.key === key)
  return def ? def[locale] : key
}

// --- special hours (holiday hours / temporary closures) — all tiers ---

export function sanitizeSpecialHours(input: unknown): SpecialHour[] {
  if (!Array.isArray(input)) return []
  const out: SpecialHour[] = []
  const seen = new Set<string>()
  for (let i = 0; i < input.length && out.length < MAX_SPECIAL_HOURS; i++) {
    const raw = input[i] as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') continue
    const date = sanitizeDate(raw.date)
    const hours = str(raw.hours, 60)
    if (!date || !hours || seen.has(date)) continue
    seen.add(date)
    out.push({ date, hours })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// One sanitizer entry point keyed by listing field, so the PATCH route can run
// every admitted structured field through its shape without a case ladder.
export const CONTENT_FIELD_SANITIZERS: Record<string, (value: unknown) => unknown> = {
  services: sanitizeServices,
  products: sanitizeProducts,
  posts: (v) => sanitizePosts(v),
  action_links: sanitizeActionLinks,
  attributes: sanitizeAttributes,
  special_hours: sanitizeSpecialHours,
}
