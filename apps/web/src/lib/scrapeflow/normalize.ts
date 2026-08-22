// Pure normalizers for the directory sink (no Firestore import → unit-testable).

import { createHash } from 'node:crypto'
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
}

const REGION_CITIES = [
  'el paso',
  'las cruces',
  'socorro',
  'horizon city',
  'canutillo',
  'anthony',
  'sunland park',
  'santa teresa',
  'fabens',
  'clint',
  'san elizario',
  'vinton',
  'mesilla',
  'chaparral',
  'hatch',
  'doña ana',
  'dona ana',
  'fort bliss',
  'tornillo',
  'westway',
  'ciudad juárez',
  'ciudad juarez',
  'cd. juárez',
  'juárez',
  'juarez',
]
// El Paso County ZIPs are 798xx/799xx; Doña Ana County is 880xx (Las Cruces 88001-88012, etc.).
const REGION_ZIP = /\b(79[89]\d{2}|880\d{2}|8801\d|8802\d|8803\d|8804\d|8805\d|8806\d|8807\d|8808\d)\b/

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

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  // Industrial / trades verticals first — their names often also contain generic words.
  [/automation|control ?systems?|systems? integrat|integrator|\bplc\b|scada|instrumentation|robotic|mechatronic|process control|motion control/i, 'Automation & Controls'],
  [/industrial (supply|supplies|equipment|distribut|products|parts|tool)|electrical (supply|supplies|wholesale|distributor)|bearing|fastener|\bmro\b|hydraulic|pneumatic|welding supply|safety supply|abrasive|conveyor|valve|pump supply|mill supply|wire ?& ?cable|industrial hardware/i, 'Industrial Supply'],
  [/electric(al|ian)s?\b|electrical contract|lighting contractor|low voltage|\bwiring\b|solar (install|electric)|generator install/i, 'Electrical Contractors'],
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
  const haystack = [listing.address, listing.city, listing.state, listing.zip].filter(Boolean).join(' ').toLowerCase()
  if (haystack) {
    if (REGION_ZIP.test(haystack)) return true
    if (REGION_CITIES.some((c) => haystack.includes(c))) return true
    // An out-of-area address is disqualifying even if the phone is local.
    if (/\b(tx|texas|nm|new mexico)\b/.test(haystack) && /\b\d{5}\b/.test(haystack)) return false
  }
  // Member directories often list phone-only entries; 915 = El Paso, 575 = southern NM.
  const digits = (listing.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return digits.length === 10 && /^(915|575)/.test(digits)
}

export function formatAddress(listing: ExtractedListing): string | null {
  const street = (listing.address || '').trim()
  const city = (listing.city || '').trim()
  const state = (listing.state || '').trim().toUpperCase()
  const zip = (listing.zip || '').trim()
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
      return w.replace(/(^|[-'/(])([a-z])/g, (_m, p, c) => p + c.toUpperCase())
    })
    .join(' ')
}

function streetNumber(address: string | null | undefined): string | null {
  const m = (address || '').match(/\b(\d{2,6})\b/)
  return m ? m[1] : null
}

/** Does an existing listing with the same name already represent this business? */
export function looksLikeSameBusiness(
  candidate: Pick<DirectoryCandidate, 'address' | 'phone'>,
  existing: { address?: string | null; phone?: string | null }
): boolean {
  const cp = (candidate.phone || '').replace(/\D/g, '')
  const ep = (existing.phone || '').replace(/\D/g, '')
  if (cp && ep && cp === ep) return true
  const cn = streetNumber(candidate.address)
  const en = streetNumber(existing.address)
  if (cn && en) return cn === en
  // Same name and neither side has a comparable address/phone: treat as the
  // same business (conservative — avoids duplicate cards for one shop).
  if (!cn && !en && (!cp || !ep)) return true
  return false
}
