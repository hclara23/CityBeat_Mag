import { BasicCrawler, log } from 'crawlee'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel.production.local') })
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') })

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

interface DirectoryCandidate {
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

interface CliOptions {
  write: boolean
  limit: number
  category: string | null
  overpassUrl: string
}

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const EL_PASO_BBOX = '31.62,-106.65,32.02,-106.15'
const CITYBEAT_USER_AGENT = 'CityBeatMagDirectoryIngest/1.0 (+https://citybeatmag.co)'

const CATEGORY_QUERIES = [
  { category: 'Restaurant', selector: '["amenity"~"^(restaurant|fast_food|food_court)$"]' },
  { category: 'Cafe', selector: '["amenity"~"^(cafe|coffee_shop)$"]' },
  { category: 'Bar', selector: '["amenity"~"^(bar|pub|biergarten|nightclub)$"]' },
  { category: 'Retail', selector: '["shop"]' },
  { category: 'Health', selector: '["amenity"~"^(clinic|dentist|doctors|pharmacy|hospital)$"]' },
  { category: 'Professional Services', selector: '["office"]' },
  { category: 'Entertainment', selector: '["amenity"~"^(cinema|theatre|arts_centre)$"]' },
  { category: 'Arts & Culture', selector: '["tourism"~"^(museum|gallery|attraction)$"]' },
  { category: 'Fitness', selector: '["leisure"~"^(fitness_centre|sports_centre)$"]' },
]

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    write: false,
    limit: 100,
    category: null,
    overpassUrl: process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL,
  }

  for (const arg of argv) {
    if (arg === '--write') options.write = true
    if (arg.startsWith('--limit=')) options.limit = Math.max(1, Number(arg.split('=')[1]) || options.limit)
    if (arg.startsWith('--category=')) options.category = arg.split('=')[1]?.trim() || null
    if (arg.startsWith('--overpass-url=')) options.overpassUrl = arg.split('=')[1]?.trim() || options.overpassUrl
  }

  return options
}

function buildOverpassQuery(selector: string): string {
  return `
    [out:json][timeout:40];
    (
      node${selector}["name"](${EL_PASO_BBOX});
      way${selector}["name"](${EL_PASO_BBOX});
      relation${selector}["name"](${EL_PASO_BBOX});
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

async function writeCandidates(candidates: DirectoryCandidate[]) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and service role key are required when running with --write.')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const rows = candidates.map((candidate) => ({
    ...candidate,
    tier: 'basic',
    claim_status: 'unclaimed',
    is_published: false,
    rating: null,
    user_ratings_total: null,
  }))

  const { error } = await supabase
    .from('directory_listings')
    .upsert(rows, { onConflict: 'google_place_id' })

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const selectedQueries = CATEGORY_QUERIES.filter((query) => {
    return !options.category || query.category.toLowerCase() === options.category?.toLowerCase()
  })

  if (selectedQueries.length === 0) {
    throw new Error(`No matching category found for "${options.category}".`)
  }

  const candidates: DirectoryCandidate[] = []

  const crawler = new BasicCrawler({
    maxConcurrency: 1,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 90,
    maxRequestsPerCrawl: selectedQueries.length,
    async requestHandler({ request }) {
      const category = String(request.userData.category || 'Business')
      log.info(`Fetching OpenStreetMap businesses for ${category}`)

      const response = await fetch(request.url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': CITYBEAT_USER_AGENT,
        },
      })

      if (!response.ok) {
        throw new Error(`Overpass returned ${response.status} for ${category}`)
      }

      const payload = (await response.json()) as OverpassResponse
      const normalized = (payload.elements || [])
        .map((element) => normalizeCandidate(element, category))
        .filter((candidate): candidate is DirectoryCandidate => Boolean(candidate))

      candidates.push(...normalized)
      log.info(`Found ${normalized.length} ${category} candidates`)
    },
    failedRequestHandler({ request, error }) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`Failed to fetch ${String(request.userData.category || request.url)}: ${message}`)
    },
  })

  await crawler.run(
    selectedQueries.map((query) => ({
      url: toOverpassUrl(options.overpassUrl, buildOverpassQuery(query.selector)),
      userData: { category: query.category },
    }))
  )

  const deduped = dedupeCandidates(candidates, options.limit)
  console.log(`Prepared ${deduped.length} deduped directory candidate(s).`)

  if (!options.write) {
    console.log('Dry run only. Re-run with --write to insert unpublished listings for admin review.')
    console.table(deduped.slice(0, 10).map(({ name, category, address, website }) => ({ name, category, address, website })))
    return
  }

  await writeCandidates(deduped)
  console.log(`Inserted or updated ${deduped.length} unpublished listing(s) for admin review.`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
