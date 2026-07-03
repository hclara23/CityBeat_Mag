import { adminDb } from '../firebase/admin'

type OsmElementType = 'node' | 'way' | 'relation'

interface OverpassElement {
  type: OsmElementType
  id: number
  lat?: number
  lon?: number
  center?: {
    lat: number
    lon: number
  }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

export interface DirectoryCandidate {
  google_place_id: string
  name: string
  category: string
  address: string | null
  phone: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  hours: Record<string, string>
}

export interface DirectoryIngestOptions {
  write?: boolean
  limit?: number
  categories?: string[]
  overpassUrl?: string
}

export interface DirectoryIngestResult {
  candidates: DirectoryCandidate[]
  inserted: number
}

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// El Paso County + Doña Ana County (Las Cruces, Anthony, Sunland Park corridor).
// Overpass bbox order: south,west,north,east.
const EL_PASO_COUNTY_BBOX = '31.25,-107.05,32.45,-105.85'
const CITYBEAT_USER_AGENT = 'CityBeatMagDirectoryIngest/1.0 (+https://citybeatmag.co)'

export const CATEGORY_QUERIES = [
  { category: 'Restaurant', selector: '["amenity"~"^(restaurant|fast_food|food_court)$"]' },
  { category: 'Auto Dealer', selector: '["shop"~"^(car|truck|motorcycle)$"]' },
  { category: 'Cafe', selector: '["amenity"~"^(cafe|coffee_shop)$"]' },
  { category: 'Bar', selector: '["amenity"~"^(bar|pub|biergarten|nightclub)$"]' },
  { category: 'Retail', selector: '["shop"]' },
  { category: 'Health', selector: '["amenity"~"^(clinic|dentist|doctors|pharmacy|hospital)$"]' },
  { category: 'Professional Services', selector: '["office"]' },
  { category: 'Entertainment', selector: '["amenity"~"^(cinema|theatre|arts_centre)$"]' },
  { category: 'Arts & Culture', selector: '["tourism"~"^(museum|gallery|attraction)$"]' },
  { category: 'Fitness', selector: '["leisure"~"^(fitness_centre|sports_centre)$"]' },
  // High lead-value verticals: businesses that live on inbound local customers.
  { category: 'Beauty', selector: '["shop"~"^(hairdresser|beauty|massage|tattoo)$"]' },
  { category: 'Auto Repair', selector: '["shop"~"^(car_repair|car_parts|tyres)$"]' },
  { category: 'Home Services', selector: '["craft"]' },
]

function buildOverpassQuery(selector: string): string {
  return `
    [out:json][timeout:40];
    (
      node${selector}["name"](${EL_PASO_COUNTY_BBOX});
      way${selector}["name"](${EL_PASO_COUNTY_BBOX});
      relation${selector}["name"](${EL_PASO_COUNTY_BBOX});
    );
    out center tags;
  `
}

function toOverpassUrl(baseUrl: string, query: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('data', query)
  return url.toString()
}

function getCategory(tags: Record<string, string> | undefined, fallback: string): string {
  if (!tags) return fallback
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'Restaurant'
  if (tags.amenity === 'cafe') return 'Cafe'
  if (tags.amenity === 'bar' || tags.amenity === 'pub' || tags.amenity === 'nightclub') return 'Bar'
  if (tags.shop === 'car' || tags.shop === 'truck' || tags.shop === 'motorcycle') return 'Auto Dealer'
  if (tags.shop) return 'Retail'
  if (tags.office) return 'Professional Services'
  if (tags.healthcare || ['clinic', 'dentist', 'doctors', 'pharmacy', 'hospital'].includes(tags.amenity || '')) return 'Health'
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return 'Arts & Culture'
  if (tags.leisure === 'fitness_centre' || tags.leisure === 'sports_centre') return 'Fitness'
  return fallback
}

function formatAddress(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim()
  const city = tags['addr:city'] || 'El Paso'
  const state = tags['addr:state'] || 'TX'
  const postcode = tags['addr:postcode']
  const locality = [city, state, postcode].filter(Boolean).join(', ').replace(', TX,', ', TX')

  if (street) return [street, locality].filter(Boolean).join(', ')
  return locality || 'El Paso, TX'
}

function normalizeWebsite(tags: Record<string, string> | undefined): string | null {
  const website = tags?.website || tags?.['contact:website'] || null
  if (!website) return null
  if (/^https?:\/\//i.test(website)) return website
  return `https://${website}`
}

function normalizePhone(tags: Record<string, string> | undefined): string | null {
  return tags?.phone || tags?.['contact:phone'] || null
}

function normalizeCandidate(element: OverpassElement, fallbackCategory: string): DirectoryCandidate | null {
  const tags = element.tags || {}
  const name = tags.name?.trim()
  if (!name) return null

  const latitude = element.lat ?? element.center?.lat ?? null
  const longitude = element.lon ?? element.center?.lon ?? null

  return {
    google_place_id: `osm:${element.type}:${element.id}`,
    name,
    category: getCategory(tags, fallbackCategory),
    address: formatAddress(tags),
    phone: normalizePhone(tags),
    website: normalizeWebsite(tags),
    latitude,
    longitude,
    description: tags.description || null,
    hours: tags.opening_hours ? { opening_hours: tags.opening_hours } : {},
  }
}

function dedupeCandidates(candidates: DirectoryCandidate[], limit: number): DirectoryCandidate[] {
  const seenSourceIds = new Set<string>()
  const seenBusinessKeys = new Set<string>()
  const deduped: DirectoryCandidate[] = []

  for (const candidate of candidates) {
    const businessKey = `${candidate.name.toLowerCase()}|${(candidate.address || '').toLowerCase()}`
    if (seenSourceIds.has(candidate.google_place_id) || seenBusinessKeys.has(businessKey)) continue
    seenSourceIds.add(candidate.google_place_id)
    seenBusinessKeys.add(businessKey)
    deduped.push(candidate)
    if (deduped.length >= limit) break
  }

  return deduped
}

async function writeCandidates(candidates: DirectoryCandidate[], _options: DirectoryIngestOptions): Promise<number> {
  // Insert-only, keyed by google_place_id. A merge-upsert here would nightly
  // reset `tier`/`claim_status`/`is_published` on businesses that have since
  // CLAIMED AND PAID — silently downgrading paying customers. Existing docs are
  // skipped entirely; contact enrichment has its own cron.
  const keyed = candidates.filter((c) => (c as any).google_place_id)
  const unkeyed = candidates.filter((c) => !(c as any).google_place_id)

  const existing = new Set<string>()
  for (let i = 0; i < keyed.length; i += 300) {
    const refs = keyed
      .slice(i, i + 300)
      .map((c) => adminDb.collection('directory_listings').doc(String((c as any).google_place_id)))
    const snaps = await adminDb.getAll(...refs)
    for (const snap of snaps) if (snap.exists) existing.add(snap.id)
  }

  const now = new Date().toISOString()
  let batch = adminDb.batch()
  let ops = 0
  let inserted = 0

  const commitIfNeeded = async () => {
    if (ops >= 450) {
      await batch.commit()
      batch = adminDb.batch()
      ops = 0
    }
  }

  for (const candidate of keyed) {
    const placeId = String((candidate as any).google_place_id)
    if (existing.has(placeId)) continue
    batch.set(adminDb.collection('directory_listings').doc(placeId), {
      ...candidate,
      tier: 'basic',
      claim_status: 'unclaimed',
      is_published: false,
      rating: null,
      user_ratings_total: null,
      created_at: now,
      updated_at: now,
    })
    ops++
    inserted++
    await commitIfNeeded()
  }

  // Candidates without a stable id can't be existence-checked cheaply; they were
  // already deduped in-batch, and normalizeCandidate always sets an OSM-derived
  // id in practice, so this path is rare.
  for (const candidate of unkeyed) {
    batch.set(adminDb.collection('directory_listings').doc(), {
      ...candidate,
      tier: 'basic',
      claim_status: 'unclaimed',
      is_published: false,
      rating: null,
      user_ratings_total: null,
      created_at: now,
      updated_at: now,
    })
    ops++
    inserted++
    await commitIfNeeded()
  }

  if (ops > 0) await batch.commit()
  return inserted
}

function selectQueries(categories: string[] | undefined) {
  if (!categories || categories.length === 0) return CATEGORY_QUERIES
  const normalizedCategories = new Set(categories.map((category) => category.toLowerCase()))
  return CATEGORY_QUERIES.filter((query) => normalizedCategories.has(query.category.toLowerCase()))
}

export async function runDirectoryIngest(options: DirectoryIngestOptions = {}): Promise<DirectoryIngestResult> {
  const limit = Math.max(1, options.limit || 100)
  const selectedQueries = selectQueries(options.categories)

  if (selectedQueries.length === 0) {
    throw new Error(`No matching category found for "${(options.categories || []).join(', ')}".`)
  }

  // Plain sequential fetch with retry. This used to run through Crawlee's
  // BasicCrawler, but its storage engine can't initialize inside the bundled
  // Next.js serverless runtime (openStorage → "reading 'bind'"), and a crawler
  // framework is overkill for fetching a handful of Overpass URLs anyway.
  const candidates: DirectoryCandidate[] = []
  for (const query of selectedQueries) {
    const url = toOverpassUrl(options.overpassUrl || DEFAULT_OVERPASS_URL, buildOverpassQuery(query.selector))
    let lastError: unknown = null
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        console.log(`Fetching OpenStreetMap businesses for ${query.category} (attempt ${attempt + 1})`)
        const response = await fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': CITYBEAT_USER_AGENT },
          signal: AbortSignal.timeout(90_000),
        })
        if (!response.ok) throw new Error(`Overpass returned ${response.status} for ${query.category}`)

        const payload = (await response.json()) as OverpassResponse
        const normalized = (payload.elements || [])
          .map((element) => normalizeCandidate(element, query.category))
          .filter((candidate): candidate is DirectoryCandidate => Boolean(candidate))
        candidates.push(...normalized)
        console.log(`Found ${normalized.length} ${query.category} candidates`)
        lastError = null
        break
      } catch (error) {
        lastError = error
        // Overpass rate-limits aggressive callers — brief pause before retrying.
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      }
    }
    if (lastError) {
      console.error(`Failed to fetch ${query.category}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
    }
  }

  const deduped = dedupeCandidates(candidates, limit)

  let inserted = 0
  if (options.write) {
    inserted = await writeCandidates(deduped, options)
  }

  return {
    candidates: deduped,
    inserted,
  }
}
