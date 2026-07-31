// Central entitlement registry for directory listings.
//
// This is the single source of truth for "what can this listing's owner do?"
// It is imported by BOTH the owner CMS (module rendering + upgrade prompts) and
// the server routes (authorization). The rule from the platform brief is
// absolute: never rely on a disabled control in the UI — every protected
// read/write must re-check the entitlement on the server via this module.
//
// Migration compatibility: entitlements resolve from the listing's activated
// `tier` field (`basic | premium | featured`), which the Stripe webhook only
// sets after confirmed payment. No schema migration or backfill is required —
// every already-paid listing carries `tier`, and anything without a recognized
// paid tier is treated as Basic. This also guarantees paid features never
// activate before payment: an unpaid/pending listing is never `premium` or
// `featured`, so a requested (but unpaid) plan can never unlock paid controls.

import { getPlan, type ListingTier } from './pricing'

// The brief's plan taxonomy. Named `DirectoryPlanKey` to avoid colliding with
// pricing.ts's existing `DirectoryPlan` interface. `founders` shares Premium's
// entitlements — it is a promotional price, not an intentionally weaker product.
export type DirectoryPlanKey = 'basic' | 'founders' | 'premium' | 'featured'

export type DirectoryEntitlements = {
  coreProfile: boolean
  enhancedDescription: boolean
  mediaLimit: number
  video: boolean
  socialLinks: boolean
  servicesAndProducts: boolean
  postsOffersEvents: boolean
  fullAnalytics: boolean
  analyticsExport: boolean
  detailedLeads: boolean
  aiAssistance: boolean
  additionalManagers: number
  bookingLinks: boolean
  priorityPlacement: boolean
  categoryBenchmarking: boolean
  multiLocation: boolean
}

// --- Tier entitlement sets (see "Recommended tier matrix" in the brief) ---

// Basic (free): accurate core business info, a basic description, one primary
// image, manual review replies, and rolling 30-day headline analytics.
const BASIC: DirectoryEntitlements = {
  coreProfile: true,
  enhancedDescription: false,
  mediaLimit: 1,
  video: false,
  socialLinks: false,
  servicesAndProducts: false,
  postsOffersEvents: false,
  fullAnalytics: false,
  analyticsExport: false,
  detailedLeads: false,
  aiAssistance: false,
  additionalManagers: 0,
  bookingLinks: false,
  priorityPlacement: false,
  categoryBenchmarking: false,
  multiLocation: false,
}

// Founders + Premium: identical, full management set. Everything except the
// Featured-only placement / benchmark / bulk perks.
const PREMIUM: DirectoryEntitlements = {
  coreProfile: true,
  enhancedDescription: true,
  mediaLimit: 15,
  video: true,
  socialLinks: true,
  servicesAndProducts: true,
  postsOffersEvents: true,
  fullAnalytics: true,
  analyticsExport: true,
  detailedLeads: true,
  aiAssistance: true,
  additionalManagers: 3,
  bookingLinks: true,
  priorityPlacement: false,
  categoryBenchmarking: false,
  multiLocation: false,
}

// Featured: every Premium entitlement plus placement/badge, competitor
// benchmarking, and higher media/manager ceilings for multi-location brands.
const FEATURED: DirectoryEntitlements = {
  ...PREMIUM,
  mediaLimit: 30,
  additionalManagers: 10,
  priorityPlacement: true,
  categoryBenchmarking: true,
  multiLocation: true,
}

const ENTITLEMENTS_BY_PLAN: Record<DirectoryPlanKey, DirectoryEntitlements> = {
  basic: BASIC,
  founders: PREMIUM,
  premium: PREMIUM,
  featured: FEATURED,
}

export type ListingEntitlementInput = {
  tier?: string | null
  plan?: string | null
  // Persisted by the Stripe webhook as `founding_member`; `founding` is accepted
  // as a legacy alias.
  founding_member?: boolean | null
  founding?: boolean | null
}

// Normalize an arbitrary stored value to a known activated tier. Only `premium`
// and `featured` unlock paid entitlements; everything else — undefined, null,
// `pending`, legacy or mis-cased strings — is Basic, the safe unpaid default.
export function normalizeListingTier(tier: unknown): ListingTier {
  return tier === 'featured' ? 'featured' : tier === 'premium' ? 'premium' : 'basic'
}

// Display/labeling plan for a listing. Uses the founding flag / plan id only to
// distinguish "Founders" from "Premium" — a cosmetic label, never an
// authorization decision (both resolve to identical entitlements).
export function directoryPlanForListing(
  listing: ListingEntitlementInput | null | undefined
): DirectoryPlanKey {
  const tier = normalizeListingTier(listing?.tier)
  if (tier === 'featured') return 'featured'
  if (tier === 'premium') {
    const plan = getPlan(listing?.plan ?? undefined)
    if (listing?.founding_member || listing?.founding || plan?.founding) return 'founders'
    return 'premium'
  }
  return 'basic'
}

// Pure plan → entitlements lookup (for UI that already knows the plan key).
export function entitlementsForPlan(plan: DirectoryPlanKey): DirectoryEntitlements {
  return ENTITLEMENTS_BY_PLAN[plan] ?? BASIC
}

// THE authorization entry point. Resolve a listing's effective entitlements from
// its activated tier. Founders (tier `premium`) transparently receives the full
// Premium set. Never key this off `plan` — only the paid `tier` is authoritative.
export function resolveEntitlements(
  listing: ListingEntitlementInput | null | undefined
): DirectoryEntitlements {
  const tier = normalizeListingTier(listing?.tier)
  if (tier === 'featured') return FEATURED
  if (tier === 'premium') return PREMIUM
  return BASIC
}

// --- Server-side write authorization ---

// Core business fields any claimed owner (including Basic) may edit.
export const CORE_LISTING_FIELDS = [
  'name',
  'phone',
  'website',
  'category',
  'address',
  'hours',
] as const

// Paid fields, mapped to the entitlement that unlocks each one. This mirrors the
// current production gating so the refactor is behavior-preserving; the Package 2
// CMS refines the split further (a *basic* description and one primary image
// become Basic-editable, while the detailed bilingual profile, full gallery,
// video, and social links stay paid).
export const PAID_LISTING_FIELDS: Record<string, keyof DirectoryEntitlements> = {
  description: 'enhancedDescription',
  image_url: 'enhancedDescription',
  gallery_urls: 'enhancedDescription',
  social_links: 'socialLinks',
}

export type FilteredListingUpdate = {
  updates: Record<string, unknown>
  rejected: string[]
}

// Split an incoming PATCH body into the fields the caller is entitled to write
// and the paid fields that were rejected. This is a strict allow-list: only the
// core and paid fields above can ever pass through — privileged fields such as
// `tier`, `owner_id`, `claim_status`, or Stripe ids are never writable here,
// even for staff. Staff (editor/developer) bypass only the *paid* gate; that
// override is role-checked by the caller and should be audited.
export function filterEntitledListingUpdate(
  body: Record<string, unknown>,
  opts: { entitlements: DirectoryEntitlements; isStaff?: boolean }
): FilteredListingUpdate {
  const updates: Record<string, unknown> = {}
  const rejected: string[] = []

  for (const field of CORE_LISTING_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  for (const [field, entitlement] of Object.entries(PAID_LISTING_FIELDS)) {
    if (!(field in body)) continue
    if (opts.isStaff || opts.entitlements[entitlement]) {
      let value = body[field]
      // Enforce the tier's media quota on the gallery so a paid owner (or a
      // tampered client) can't persist an unbounded number of photos. Staff
      // bypass the quota, consistent with the paid-gate override.
      if (field === 'gallery_urls' && !opts.isStaff && Array.isArray(value)) {
        value = value.slice(0, Math.max(0, opts.entitlements.mediaLimit))
      }
      updates[field] = value
    } else {
      rejected.push(field)
    }
  }

  return { updates, rejected }
}

// --- Listing management authorization ---

export type ListingPatchAccess = {
  isOwner: boolean
  isStaff: boolean
  canManage: boolean
}

// Who may edit a directory listing: the approved owner, or staff
// (editor/developer). Pure and testable so the auth boundary itself is covered,
// not just the entitlement filter. `claim_status` must be `approved` for owner
// access — a pending/rejected claim does not grant edit rights.
export function resolveListingPatchAccess(
  listing: { owner_id?: string | null; claim_status?: string | null } | null | undefined,
  actor: { userId?: string | null; isStaff?: boolean }
): ListingPatchAccess {
  const isStaff = Boolean(actor.isStaff)
  const isOwner = Boolean(
    actor.userId && listing?.owner_id === actor.userId && listing?.claim_status === 'approved'
  )
  return { isOwner, isStaff, canManage: isOwner || isStaff }
}

// Did this write rely on the staff override — i.e. would a plain owner of this
// listing have been denied? True when staff edits a listing they do not own, or
// when staff wrote a paid field the listing's own tier would not unlock. These
// writes must be audited (non-negotiable: staff overrides are role-checked AND
// audited).
export function isStaffOverrideWrite(opts: {
  isStaff: boolean
  isOwner: boolean
  entitlements: DirectoryEntitlements
  writtenFields: string[]
}): boolean {
  if (!opts.isStaff) return false
  if (!opts.isOwner) return true
  return opts.writtenFields.some(
    (field) => field in PAID_LISTING_FIELDS && !opts.entitlements[PAID_LISTING_FIELDS[field]]
  )
}

// --- Upgrade copy (bilingual) ---
//
// One concise "what you're missing" line per lockable capability, EN + ES.
// Consumed by the owner CMS to label locked modules (non-negotiable #4) and by
// upgrade prompts. `coreProfile` is never locked, so it carries no copy.
type LocaleCopy = { label: string; benefit: string }

export const ENTITLEMENT_COPY: Partial<
  Record<keyof DirectoryEntitlements, { en: LocaleCopy; es: LocaleCopy }>
> = {
  enhancedDescription: {
    en: {
      label: 'Detailed bilingual profile',
      benefit: 'Tell your full story in English and Spanish to reach every El Paso customer.',
    },
    es: {
      label: 'Perfil bilingüe detallado',
      benefit: 'Cuenta tu historia completa en inglés y español para llegar a todo El Paso.',
    },
  },
  mediaLimit: {
    en: {
      label: 'Full photo gallery',
      benefit: 'Show up to 15 photos instead of one so customers see the real you.',
    },
    es: {
      label: 'Galería de fotos completa',
      benefit: 'Muestra hasta 15 fotos en vez de una para que te conozcan de verdad.',
    },
  },
  video: {
    en: { label: 'Video', benefit: 'Add a video tour or promo to stand out in search results.' },
    es: { label: 'Video', benefit: 'Agrega un video o promoción para destacar en los resultados.' },
  },
  socialLinks: {
    en: {
      label: 'Social links',
      benefit: 'Send visitors straight to your Facebook, Instagram, and more.',
    },
    es: {
      label: 'Redes sociales',
      benefit: 'Envía a los visitantes directo a tu Facebook, Instagram y más.',
    },
  },
  servicesAndProducts: {
    en: {
      label: 'Services & products',
      benefit: 'List what you offer with prices so customers arrive ready to buy.',
    },
    es: {
      label: 'Servicios y productos',
      benefit: 'Publica lo que ofreces con precios para que lleguen listos para comprar.',
    },
  },
  postsOffersEvents: {
    en: {
      label: 'Posts, offers & events',
      benefit: 'Publish deals and events that surface across CityBeat.',
    },
    es: {
      label: 'Publicaciones, ofertas y eventos',
      benefit: 'Publica ofertas y eventos que aparecen en todo CityBeat.',
    },
  },
  fullAnalytics: {
    en: {
      label: 'Full analytics',
      benefit: 'See full history, comparisons, and exportable performance reports.',
    },
    es: {
      label: 'Analíticas completas',
      benefit: 'Ve historial completo, comparaciones e informes exportables.',
    },
  },
  analyticsExport: {
    en: {
      label: 'Export reports',
      benefit: 'Download your performance data as CSV for your own records.',
    },
    es: {
      label: 'Exportar informes',
      benefit: 'Descarga tus datos de rendimiento en CSV para tus registros.',
    },
  },
  detailedLeads: {
    en: {
      label: 'Full lead inbox',
      benefit: 'See every customer inquiry with full contact details, not just totals.',
    },
    es: {
      label: 'Bandeja de clientes completa',
      benefit: 'Ve cada solicitud con datos de contacto completos, no solo totales.',
    },
  },
  aiAssistance: {
    en: {
      label: 'AI assistance',
      benefit: 'Let CityBeat draft replies, posts, and captions for you.',
    },
    es: {
      label: 'Asistencia con IA',
      benefit: 'Deja que CityBeat redacte respuestas, publicaciones y textos por ti.',
    },
  },
  additionalManagers: {
    en: { label: 'Team access', benefit: 'Invite staff to help manage your listing.' },
    es: { label: 'Acceso de equipo', benefit: 'Invita a tu personal a ayudar a administrar tu ficha.' },
  },
  bookingLinks: {
    en: {
      label: 'Booking & action links',
      benefit: 'Add “Book”, “Order”, or “Quote” buttons to your listing.',
    },
    es: {
      label: 'Enlaces de reserva y acción',
      benefit: 'Agrega botones de “Reservar”, “Pedir” o “Cotizar” a tu ficha.',
    },
  },
  priorityPlacement: {
    en: {
      label: 'Priority placement & badge',
      benefit: 'Rank at the top of your category with a Featured badge.',
    },
    es: {
      label: 'Ubicación prioritaria e insignia',
      benefit: 'Aparece al principio de tu categoría con una insignia destacada.',
    },
  },
  categoryBenchmarking: {
    en: {
      label: 'Competitor benchmarks',
      benefit: 'See how you compare to similar businesses in your category.',
    },
    es: {
      label: 'Comparativas de competencia',
      benefit: 'Ve cómo te comparas con negocios similares en tu categoría.',
    },
  },
  multiLocation: {
    en: {
      label: 'Multi-location & bulk tools',
      benefit: 'Manage every location from one place with bulk editing.',
    },
    es: {
      label: 'Herramientas de varias ubicaciones',
      benefit: 'Administra todas tus ubicaciones desde un solo lugar con edición masiva.',
    },
  },
}
