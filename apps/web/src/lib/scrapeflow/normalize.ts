// Pure normalizers for the directory sink (no Firestore import → unit-testable).

import { createHash } from 'node:crypto'
import { assessLocality, normalizedAddress, hasStreetAddress } from '@citybeat/lib/directory/quality'
import { DIRECTORY_CATEGORIES } from '@/lib/categories'
import type { ExtractedListing } from './types'

export interface DirectoryCandidate {
  google_place_id: string
  name: string
  category: string
  address: string | null
  phone: string | null
  website: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  hours: Record<string, string>
  source: 'scrapeflow'
  source_url: string | null
  city?: string | null
  state?: string | null
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  if (digits.length !== 10) return raw.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function normalizeWebsite(raw: string | null | undefined, sourceUrl?: string | null): string | null {
  if (!raw) return null
  let url = raw.trim().replace(/^\[|\]$/g, '')
  if (!url || /^(n\/?a|none|null)$/i.test(url)) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    if (!/\./.test(parsed.hostname)) return null
    // Never link a listing back to the directory we scraped it from.
    if (sourceUrl) {
      try {
        const src = new URL(sourceUrl)
        if (parsed.hostname.replace(/^www\./, '') === src.hostname.replace(/^www\./, '')) return null
      } catch {
        /* ignore */
      }
    }
    if (/(facebook|instagram|twitter|x|linkedin|yelp|google)\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) {
      return parsed.toString()
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  return m ? m[0] : null
}

// THE PERMISSIVE MATCHING IS DELIBERATE. Do not add \b boundaries.
//
// I added them on 2026-10-28 and reverted them the same day, because the
// premise was wrong. The reasoning, so nobody repeats it:
//
// There is exactly ONE caller — toCandidate below — and it passes
// `listing.category`, a CATEGORY LABEL, never a business name. I had audited
// 565 FMCSA carriers by feeding this table their NAMES, watched it suggest
// nonsense ("Martinez" -> Arts & Culture on the "art" inside "Mart",
// "Dispatch" -> Beauty on the "spa"), and concluded the AI-extraction path was
// silently mis-filing listings. It was not: nothing passes a name, so the
// misfires I demonstrated cannot occur in production. The audit misused the
// function and I generalised from the misuse.
//
// Then auditing all 29,430 live listings against the boundaried table found
// zero victims of the supposed bug and 60 rows the boundaries would BREAK —
// every one a compound where the mid-word match was correct: "Medspa",
// "MedSpa at Southwest Plastic Surgery", "Eyelash Extensions",
// "Dermaesthetics", eight "Seafood" restaurants, "MiSushi", "BuhosCantina",
// "Gymnasium", "HVACGuys", "Taxrite", "TEXASBANK", "Artwork by Lisa Matta".
// Category labels in this market are routinely compounds, so matching inside a
// word is the feature, not the defect — `\bspa\b` misses Medspa, `\bart\b`
// misses Artwork, `\bgym\b` misses Gymnasium, and a leading `\b` alone misses
// Seafood and Sushi.
//
// If a caller is ever added that passes a NAME, the right fix is to give that
// caller its own stricter matcher, not to tighten this one.
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  // Industrial / trades verticals first — their names often also contain generic words.
  [/automation|control ?systems?|systems? integrat|integrator|\bplc\b|scada|instrumentation|robotic|mechatronic|process control|motion control/i, 'Automation & Controls'],
  [/industrial (supply|supplies|equipment|distribut|products|parts|tool)|electrical (supply|supplies|wholesale|distributor)|bearing|fastener|\bmro\b|hydraulic|pneumatic|welding supply|safety supply|abrasive|conveyor|valve|pump supply|mill supply|wire ?& ?cable|industrial hardware/i, 'Industrial Supply'],
  [/electric(al|ian)s?\b|electrical contract|lighting contractor|low voltage|\bwiring\b|solar (install|electric)|generator install/i, 'Electrical Contractors'],
  // Narrow verticals that would otherwise fall into a broader bucket below (Entertainment,
  // Arts & Culture, Retail, Professional Services) — must be checked before those.
  [/banquet hall|quincea[ñn]era|wedding (venue|planner|coordinator)|event (planner|venue|space|rental|production)|party rental|photo booth|\bdj service|bridal/i, 'Event Services'],
  [/day ?care|child ?care|preschool|pre-?k\b|montessori|\btutor|driving school|music (school|lessons?)|dance (school|studio)|learning center|test prep|after-?school program/i, 'Childcare & Education'],
  [/customs broker|freight forward|\b3pl\b|third-party logistics|warehousing|trucking company|freight carrier|cargo|cross-?dock|import.{0,3}export|maquila/i, 'Logistics & Freight'],
  [/attorney|lawyer|law (firm|office)|legal/i, 'Attorneys'],
  [/real ?estate|realt|broker|property management|apartments?/i, 'Real Estate'],
  [/title|notary|escrow/i, 'Title & Notary'],
  [/insurance|insur/i, 'Insurance'],
  [/bank|credit union|financ|account|cpa|tax|bookkeep|mortgage|lending|invest|wealth/i, 'Financial'],
  [/marketing|advertis|branding|graphic|design agency|pr firm|public relations|printing|signs?\b/i, 'Marketing'],
  [/web (design|dev)|software|\bit\b|technology|computer|hosting|digital/i, 'Web Development'],
  [/restaurant|taquer|grill|steakhouse|pizza|sushi|diner|kitchen|bbq|eatery|cantina|food/i, 'Restaurant'],
  [/coffee|espresso/i, 'Coffee Shop'],
  [/caf[eé]|bakery|panader|pastry|dessert|ice cream|paleter/i, 'Cafe'],
  [/\bbar\b|pub|brewery|lounge|nightclub|cantina|winery|tavern/i, 'Bar'],
  [/auto (sales|dealer)|dealership|cars?\b|motors|trucks?\b/i, 'Auto Dealer'],
  [/auto (repair|service|body)|mechanic|tire|collision|transmission|oil change/i, 'Auto Repair'],
  [/plumb|electric|hvac|roof|landscap|contractor|construction|remodel|cleaning|pest|painting|handyman|home (service|improvement)|garage door|solar/i, 'Home Services'],
  [/salon|spa|beauty|barber|nails?|hair|massage|tattoo|cosmetic|aesthetic|lash/i, 'Beauty'],
  [/clinic|dental|dentist|doctor|physician|medical|health|pharmacy|hospital|chiropract|therapy|wellness|optometr|pediatric|urgent care|hospice|home care/i, 'Health'],
  [/gym|fitness|yoga|crossfit|martial arts|boxing|pilates|athletic/i, 'Fitness'],
  [/theater|theatre|cinema|entertainment|arcade|bowling|escape room|amusement|venue|event/i, 'Entertainment'],
  [/museum|gallery|art|cultur|music|dance|studio/i, 'Arts & Culture'],
  [/shop|store|boutique|retail|market|furniture|jewel|cloth|apparel|gift|florist|supply|mall|outlet/i, 'Retail'],
  [/consult|staffing|recruit|engineering|architect|security|logistics|transport|nonprofit|non-profit|association|chamber|church|school|university|college|education|training|government|services/i, 'Professional Services'],
]

export function mapCategory(raw: string | null | undefined, fallback: string): string {
  const allowed = DIRECTORY_CATEGORIES as readonly string[]
  const safeFallback = allowed.includes(fallback) ? fallback : 'Professional Services'
  if (!raw) return safeFallback
  const trimmed = raw.trim()
  const exact = allowed.find((c) => c.toLowerCase() === trimmed.toLowerCase())
  if (exact) return exact
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(trimmed)) return cat
  return safeFallback
}

export function inRegion(listing: Pick<ExtractedListing, 'address' | 'city' | 'state' | 'zip' | 'phone'>): boolean {
  return assessLocality(listing).status === 'inside'
}

/**
 * ZIP+4 with no separator is a ZIP+4, not a nine-digit ZIP. TABC stores it that
 * way; FMCSA stores the hyphenated form. Anything that is not exactly 5 or 9
 * digits is passed through untouched rather than guessed at.
 */
export function normalizeZip(zip: string): string {
  const digits = zip.replace(/\D/g, '')
  if (digits.length === 9 && !zip.includes('-')) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return zip
}

export function formatAddress(listing: ExtractedListing): string | null {
  const street = (listing.address || '').trim()
  const city = (listing.city || '').trim()
  const state = (listing.state || '').trim().toUpperCase()
  // TABC publishes ZIP+4 with no separator, so this produced addresses like
  // "El Paso, TX 799367634" — a wrong address on 603 published listings, and one
  // the directory's own "City or ZIP code" search can never match. Split it back
  // into the standard hyphenated form.
  const zip = normalizeZip((listing.zip || '').trim())
  // If `address` already carries the city/state, don't double up.
  const streetHasCity = city && street.toLowerCase().includes(city.toLowerCase())
  const locality = streetHasCity ? '' : [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const full = [street, locality].filter(Boolean).join(', ').trim()
  return full || null
}

export function listingKey(name: string, address: string | null, phone: string | null): string {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = (address || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const p = (phone || '').replace(/\D/g, '')
  // Name + street number/first token when available, else name + phone.
  const streetSig = a.split(' ').slice(0, 2).join(' ')
  return `${n}|${streetSig || p}`
}

export function toCandidate(
  listing: ExtractedListing,
  opts: { defaultCategory: string; sourceUrl: string | null }
): DirectoryCandidate | null {
  const name = (listing.name || '').replace(/\s+/g, ' ').trim()
  if (!name || name.length < 2 || name.length > 120) return null
  const address = formatAddress(listing)
  const phone = normalizePhone(listing.phone)
  const key = listingKey(name, address, phone)
  // A real Google place id (from SEARCH_GOOGLE_PLACES) becomes the doc id so it
  // lines up with Google-sourced rows and the Places-based enrichment cron.
  const placeId = typeof listing.google_place_id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(listing.google_place_id) ? listing.google_place_id : null
  const id = placeId || `sf:${createHash('sha1').update(key).digest('hex').slice(0, 24)}`
  const lat = Number(listing.latitude)
  const lng = Number(listing.longitude)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
  return {
    google_place_id: id,
    name,
    category: mapCategory(listing.category, opts.defaultCategory),
    address,
    phone,
    website: normalizeWebsite(listing.website, listing.source_url || opts.sourceUrl),
    email: normalizeEmail(listing.email),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    description: listing.description ? String(listing.description).trim().slice(0, 600) || null : null,
    hours: {},
    source: 'scrapeflow',
    source_url: listing.source_url || opts.sourceUrl,
    city: listing.city || null,
    state: listing.state || null,
  }
}

const KEEP_UPPER = new Set(['LLC', 'INC', 'CO', 'CORP', 'LTD', 'LP', 'LLP', 'PC', 'PLLC', 'USA', 'HVAC', 'AC', 'A/C', 'DBA', 'II', 'III', 'IV', 'TX', 'NM', 'EP', 'RV', 'IT', 'AV', 'PLC', 'LED', 'UV', 'CNC', 'MRO', 'DC'])

/** Fix ALL-CAPS government data: "BELTRAN ELECTRICAL CONTRACTORS, INC." → "Beltran Electrical Contractors, Inc."; "PEREZ, MARIO" → "Mario Perez". */
export function titleCaseName(raw: string): string {
  let name = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!name) return name
  const isUpper = name === name.toUpperCase() && /[A-Z]/.test(name)
  if (!isUpper) return name
  // "LAST, FIRST [MIDDLE]" (sole proprietor license holders) → "First Middle Last"
  const person = name.match(/^([A-Z'\- ]{2,}), ([A-Z'\- .]{2,})$/)
  if (person && !/\b(LLC|INC|CORP|CO|LTD|LP|DBA|ELECTRIC|SERVICE|CONTRACT)/.test(name)) {
    name = `${person[2]} ${person[1]}`
  }
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => {
      const bare = w.replace(/[.,()]/g, '').toUpperCase()
      if (KEEP_UPPER.has(bare)) return w.toUpperCase()
      const cased = w.replace(/(^|[-'/(&.])([a-z])/g, (_m, p, c) => p + c.toUpperCase())
      // Possessive "'s" at the end of a word (Marti's, Denny's) is not an
      // initial — the apostrophe-triggered capitalization above over-fires on it.
      return cased.replace(/'S$/, "'s")
    })
    .join(' ')
}

/** Only an exact normalized full address proves the same location.
 * Shared switchboards, street numbers and missing evidence never merge branches. */
export function looksLikeSameBusiness(
  candidate: Pick<DirectoryCandidate, 'address' | 'phone'>,
  existing: { address?: string | null; phone?: string | null }
): boolean {
  const address = normalizedAddress(candidate.address)
  return Boolean(hasStreetAddress(candidate.address) && address === normalizedAddress(existing.address))
}
