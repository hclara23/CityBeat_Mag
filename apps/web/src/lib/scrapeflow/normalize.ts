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
  'midland',
  'odessa',
  'andrews',
  'big spring',
  'pecos',
  'fort stockton',
  'alpine',
  'marfa',
  'presidio',
  'van horn',
  'monahans',
  'kermit',
  'crane',
  'mccamey',
  'rankin',
  'ciudad juárez',
  'ciudad juarez',
  'cd. juárez',
  'juárez',
  'juarez',
]
// West Texas ZIPs are 795xx-799xx; southern New Mexico ZIPs are 880xx-883xx.
const REGION_ZIP = /\b(79[5-9]\d{2}|88[0-3]\d{2})\b/

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

// EVERY alternative is anchored with a leading \b, and the short whole words
// carry a trailing \b too.
//
// WHY. These matched anywhere inside a word, so a business was categorised by
// an accident of spelling. Found by auditing 565 FMCSA motor carriers against
// this table, where it wanted to move 358 of them and the moves were nonsense:
// "Martinez" and "Martal Logistics" became Arts & Culture on the "art" inside
// "Mart"; "Dispatch Service" became Beauty on the "spa" inside "Dispatch";
// "Diamond Bar D Livestock" became Bar; "Gun IT Hot Shot" became Web
// Development. The same trap reaches every listing that flows through
// mapCategory — i.e. the whole AI-extraction path — so "Avenue" matched venue
// (Entertainment), "Taxi" matched tax (Financial), "Republic" matched pub
// (Bar), "Restore" matched store and "Smalley" matched mall (Retail),
// "Waterproofing" matched roof, "Burbank" matched bank, and "Agricultural"
// matched cultur.
//
// A LEADING \b is the right default because it costs nothing: the intentional
// prefix matches still work — \bcultur still matches "cultural", \broof still
// matches "Roofing", \brealt still matches "Realtors" — while mid-word
// collisions stop. A TRAILING \b is added only where the token is a complete
// short word that would otherwise swallow longer ones: art, spa, pub, mall,
// tax, caf[eé] stays open so it still reaches "Cafeteria".
//
// Two names in that audit stay ambiguous and are NOT regex-fixable: "Diamond
// Bar D Livestock Transport" (a Texas ranch brand, and \bbar\b is already as
// tight as it gets) and "Wind Dancer Express" ("Dancer" genuinely begins with
// "dance"). Context, not a pattern, is what would separate those.
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  // Industrial / trades verticals first — their names often also contain generic words.
  [/\bautomation|\bcontrol ?systems?|\bsystems? integrat|\bintegrator|\bplc\b|\bscada|\binstrumentation|\brobotic|\bmechatronic|\bprocess control|\bmotion control/i, 'Automation & Controls'],
  [/\bindustrial (supply|supplies|equipment|distribut|products|parts|tool)|\belectrical (supply|supplies|wholesale|distributor)|\bbearing|\bfastener|\bmro\b|\bhydraulic|\bpneumatic|\bwelding supply|\bsafety supply|\babrasive|\bconveyor|\bvalve|\bpump supply|\bmill supply|\bwire ?& ?cable|\bindustrial hardware/i, 'Industrial Supply'],
  [/\belectric(al|ian)s?\b|\belectrical contract|\blighting contractor|\blow voltage|\bwiring\b|\bsolar (install|electric)|\bgenerator install/i, 'Electrical Contractors'],
  // Narrow verticals that would otherwise fall into a broader bucket below (Entertainment,
  // Arts & Culture, Retail, Professional Services) — must be checked before those.
  [/\bbanquet hall|\bquincea[ñn]era|\bwedding (venue|planner|coordinator)|\bevent (planner|venue|space|rental|production)|\bparty rental|\bphoto booth|\bdj service|\bbridal/i, 'Event Services'],
  [/\bday ?care|\bchild ?care|\bpreschool|\bpre-?k\b|\bmontessori|\btutor|\bdriving school|\bmusic (school|lessons?)|\bdance (school|studio)|\blearning center|\btest prep|\bafter-?school program/i, 'Childcare & Education'],
  [/\bcustoms broker|\bfreight forward|\b3pl\b|\bthird-party logistics|\bwarehousing|\btrucking company|\bfreight carrier|\bcargo|\bcross-?dock|\bimport.{0,3}export|\bmaquila/i, 'Logistics & Freight'],
  [/\battorney|\blawyer|\blaw (firm|office)|\blegal/i, 'Attorneys'],
  [/\breal ?estate|\brealt|\bbroker|\bproperty management|\bapartments?/i, 'Real Estate'],
  [/\btitle|\bnotary|\bescrow/i, 'Title & Notary'],
  [/\binsurance|\binsur/i, 'Insurance'],
  [/\bbank|\bcredit union|\bfinanc|\baccount|\bcpa\b|\btax\b|\btaxes\b|\bbookkeep|\bmortgage|\blending|\binvest|\bwealth/i, 'Financial'],
  [/\bmarketing|\badvertis|\bbranding|\bgraphic|\bdesign agency|\bpr firm|\bpublic relations|\bprinting|\bsigns?\b/i, 'Marketing'],
  // A bare \bit\b matched the English word: "Gun IT Hot Shot", "Keep IT
  // Pushing" and "Haul IT All" were all filed as Web Development. A real IT
  // firm names what it does, so require the qualifier.
  [/\bweb (design|dev)|\bsoftware|\binformation technology\b|\bit (services?|support|solutions?|consulting|company)\b|\btechnology|\bcomputer|\bhosting|\bdigital/i, 'Web Development'],
  [/\brestaurant|\btaquer|\bgrill|\bsteakhouse|\bpizza|\bsushi|\bdiner|\bkitchen|\bbbq\b|\beatery|\bcantina|\bfood/i, 'Restaurant'],
  [/\bcoffee|\bespresso/i, 'Coffee Shop'],
  [/\bcaf[eé]|\bbakery|\bpanader|\bpastry|\bdessert|\bice cream|\bpaleter/i, 'Cafe'],
  [/\bbar\b|\bpub\b|\bbrewery|\blounge|\bnightclub|\bcantina|\bwinery|\btavern/i, 'Bar'],
  [/\bauto (sales|dealer)|\bdealership|\bcars?\b|\bmotors|\btrucks?\b/i, 'Auto Dealer'],
  [/\bauto (repair|service|body)|\bmechanic|\btire|\bcollision|\btransmission|\boil change/i, 'Auto Repair'],
  [/\bplumb|\belectric|\bhvac\b|\broof|\blandscap|\bcontractor|\bconstruction|\bremodel|\bcleaning|\bpest\b|\bpainting|\bhandyman|\bhome (service|improvement)|\bgarage door|\bsolar/i, 'Home Services'],
  [/\bsalon|\bspa\b|\bbeauty|\bbarber|\bnails?\b|\bhair|\bmassage|\btattoo|\bcosmetic|\baesthetic|\blash/i, 'Beauty'],
  [/\bclinic|\bdental|\bdentist|\bdoctor|\bphysician|\bmedical|\bhealth|\bpharmacy|\bhospital|\bchiropract|\btherapy|\bwellness|\boptometr|\bpediatric|\burgent care|\bhospice|\bhome care/i, 'Health'],
  [/\bgym\b|\bfitness|\byoga\b|\bcrossfit|\bmartial arts|\bboxing|\bpilates|\bathletic/i, 'Fitness'],
  [/\btheater|\btheatre|\bcinema|\bentertainment|\barcade|\bbowling|\bescape room|\bamusement|\bvenue|\bevent/i, 'Entertainment'],
  [/\bmuseum|\bgallery|\bart\b|\barts\b|\bcultur|\bmusic|\bdance|\bstudio/i, 'Arts & Culture'],
  [/\bshop|\bstore|\bboutique|\bretail|\bmarket|\bfurniture|\bjewel|\bcloth|\bapparel|\bgift|\bflorist|\bsupply|\bmall\b|\boutlet/i, 'Retail'],
  [/\bconsult|\bstaffing|\brecruit|\bengineering|\barchitect|\bsecurity|\blogistics|\btransport|\bnonprofit|\bnon-profit|\bassociation|\bchamber|\bchurch|\bschool|\buniversity|\bcollege|\beducation|\btraining|\bgovernment|\bservices/i, 'Professional Services'],
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
