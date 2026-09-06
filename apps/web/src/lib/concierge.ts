import { adminDb } from '@citybeat/lib/firebase/admin'

// Retrieval for the "Ask CityBeat" concierge: grounds chat answers in the real
// directory / events / deals so the model recommends actual local businesses
// (premium first) instead of hallucinating. No vector store — keyword scoring
// over a cached, projected corpus.
//
// This file used to say "the corpus is a few hundred rows". It stopped being
// true after the 2026-08 scraping sweeps: `directory_listings` is ~6,700
// published rows and grows every night from citybeat-directory-ingest and
// citybeat-scrapeflow. Meanwhile loadCorpus() ran on the request path of
// /api/chat — public and unauthenticated — with no .limit(), no .select() and
// no guard against concurrent misses, so ten chat messages arriving inside the
// ~5s that read takes each issued their own uncapped read of every listing,
// event and deal document, and held ten independent copies of the result on a
// 2Gi instance. The per-IP rate limit does not bound this: instance count and
// cache expiry drive the reads, not any one caller's rate.

type Biz = {
  id: string
  name: string
  category: string
  address: string
  phone: string
  website: string
  tier: string
}

type Ev = { id: string; title: string; venue: string; date: string }
type Deal = { id: string; listing_id: string; title: string; description: string; business: string }

type Corpus = { businesses: Biz[]; events: Ev[]; deals: Deal[] }

let cache: { at: number; corpus: Corpus } | null = null
let inFlight: Promise<Corpus> | null = null
const CACHE_MS = 10 * 60 * 1000

// Hard backstops so an unbounded collection can never OOM the container. The
// listing cap matches CORPUS_MAX_DOCS in api/directory/route.ts, which got this
// treatment first; the concierge reads the same collection and never got it.
const MAX_LISTINGS = 8000
const MAX_EVENTS = 60
const MAX_DEALS = 500

// Only these fields are scored or printed, so .select() keeps the whole corpus
// out of the heap. Firestore still bills one read per document — the TTL cache
// plus the single-flight guard below are what bound the bill.
const LISTING_FIELDS = ['name', 'category', 'address', 'phone', 'website', 'tier']
const EVENT_FIELDS = ['title_en', 'venue', 'meta_en', 'start_date', 'status']
const DEAL_FIELDS = ['listing_id', 'title', 'description', 'business_name', 'is_active']

async function fetchCorpus(): Promise<Corpus> {
  // Events were read in full and sorted/sliced to 30 in memory, so every past
  // event ever created was billed to answer "what's happening this weekend".
  // A range filter on start_date plus an orderBy on the SAME field needs only
  // the automatic single-field index. Two days of slack keeps the precise
  // one-day cutoff below in memory (start_date is stored both as ISO-with-Z and
  // as naive local `YYYY-MM-DDTHH:mm:ss`; both begin with YYYY-MM-DD).
  const eventFloor = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
  const [bizSnap, evSnap, dealSnap] = await Promise.all([
    adminDb.collection('directory_listings').where('is_published', '==', true).select(...LISTING_FIELDS).limit(MAX_LISTINGS).get().catch(() => null),
    adminDb.collection('events').where('start_date', '>=', eventFloor).orderBy('start_date', 'asc').select(...EVENT_FIELDS).limit(MAX_EVENTS).get().catch(() => null),
    adminDb.collection('deals').select(...DEAL_FIELDS).limit(MAX_DEALS).get().catch(() => null),
  ])

  // A total read failure must not overwrite a good corpus with an empty one and
  // then serve that for the whole TTL — the concierge would recommend nothing at
  // all, to everyone, for ten minutes. Throw instead, and let loadCorpus() keep
  // serving the previous snapshot and retry on the next message.
  if (!bizSnap && !evSnap && !dealSnap) throw new Error('concierge corpus read failed')

  const businesses: Biz[] = ((bizSnap?.docs ?? []) as any[]).map((d) => {
    const x = d.data()
    return {
      id: d.id,
      name: String(x.name || ''),
      category: String(x.category || ''),
      address: String(x.address || ''),
      phone: String(x.phone || ''),
      website: String(x.website || ''),
      tier: String(x.tier || 'basic'),
    }
  })

  const now = Date.now()
  const events: Ev[] = ((evSnap?.docs ?? []) as any[])
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        title: String(x.title_en || ''),
        venue: String(x.venue || x.meta_en || ''),
        date: String(x.start_date || ''),
        _status: x.status,
      }
    })
    .filter((e: any) => e._status !== 'pending' && e._status !== 'rejected' && Date.parse(e.date) > now - 86400000)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30)
    .map(({ id, title, venue, date }) => ({ id, title, venue, date }))

  const deals: Deal[] = ((dealSnap?.docs ?? []) as any[])
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        listing_id: String(x.listing_id || ''),
        title: String(x.title || ''),
        description: String(x.description || '').slice(0, 160),
        business: String(x.business_name || ''),
        _active: x.is_active !== false,
      }
    })
    .filter((d: any) => d._active)
    .slice(0, 20)
    .map(({ id, listing_id, title, description, business }) => ({ id, listing_id, title, description, business }))

  return { businesses, events, deals }
}

async function loadCorpus(): Promise<Corpus> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.corpus

  // Single-flight: the TTL lapses for every concurrent request at the same
  // instant, and Cloud Run scales out under load, so without this each request
  // that arrived during the ~5s refresh issued its own full-collection read.
  if (!inFlight) {
    inFlight = fetchCorpus()
      .then((corpus) => {
        cache = { at: Date.now(), corpus }
        return corpus
      })
      .catch(() => {
        // `cache.at` is deliberately left alone so the next message retries.
        return cache?.corpus ?? { businesses: [], events: [], deals: [] }
      })
      .finally(() => {
        inFlight = null
      })
  }

  // Serve the stale snapshot rather than stalling a public chat request behind
  // a multi-second refresh; the refresh above is already running.
  if (cache) return cache.corpus
  return inFlight
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents so "Juárez" matches "juarez"
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

// Light ES→EN category bridging so Spanish queries hit English-tagged data.
const SYNONYMS: Record<string, string[]> = {
  restaurante: ['restaurant'], comida: ['restaurant', 'food'], tacos: ['restaurant', 'mexican'],
  cafe: ['cafe', 'coffee'], bar: ['bar'], gimnasio: ['fitness', 'gym'], dentista: ['dentist', 'health'],
  doctor: ['health', 'clinic'], salon: ['beauty', 'hairdresser'], belleza: ['beauty'],
  taller: ['auto', 'repair'], carro: ['auto', 'car'], auto: ['auto', 'car'], abogado: ['office', 'professional'],
  plomero: ['plumber', 'home'], electricista: ['electrician', 'home'], evento: ['event'], eventos: ['event'],
}

function expand(tokens: string[]): string[] {
  const out = [...tokens]
  for (const t of tokens) if (SYNONYMS[t]) out.push(...SYNONYMS[t])
  return out
}

export async function retrieveLocalContext(query: string): Promise<string> {
  const corpus = await loadCorpus()
  const qTokens = expand(tokenize(query))
  if (qTokens.length === 0) return ''

  const scored = corpus.businesses
    .map((b) => {
      const hay = tokenize(`${b.name} ${b.category} ${b.address}`)
      let score = 0
      for (const t of qTokens) if (hay.some((h) => h.includes(t) || t.includes(h))) score++
      // Paying tiers rank first among equally relevant results — this is the
      // "AI placement" perk and is disclosed in the answer as a featured partner.
      if (score > 0 && b.tier === 'featured') score += 2
      if (score > 0 && b.tier === 'premium') score += 1
      return { b, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const evScored = corpus.events
    .map((e) => {
      const hay = tokenize(`${e.title} ${e.venue} event evento`)
      let score = 0
      for (const t of qTokens) if (hay.some((h) => h.includes(t) || t.includes(h))) score++
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const dealScored = corpus.deals
    .map((d) => {
      const hay = tokenize(`${d.title} ${d.description} ${d.business} deal descuento oferta`)
      let score = 0
      for (const t of qTokens) if (hay.some((h) => h.includes(t) || t.includes(h))) score++
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .slice(0, 4)

  const parts: string[] = []
  if (scored.length) {
    parts.push(
      'LOCAL BUSINESSES (cite as markdown links to /en/directory/{id}):\n' +
        scored
          .map(({ b }) =>
            `- ${b.name} | id:${b.id} | ${b.category}${b.tier !== 'basic' ? ` | ${b.tier.toUpperCase()} PARTNER` : ''}${b.address ? ` | ${b.address}` : ''}${b.phone ? ` | ${b.phone}` : ''}`
          )
          .join('\n')
    )
  }
  if (evScored.length) {
    parts.push(
      'UPCOMING EVENTS (cite as links to /en/events/{id}):\n' +
        evScored.map(({ e }) => `- ${e.title} | id:${e.id} | ${e.venue} | ${e.date.slice(0, 10)}`).join('\n')
    )
  }
  if (dealScored.length) {
    parts.push(
      'ACTIVE DEALS (cite the business page /en/directory/{listing_id}):\n' +
        dealScored.map(({ d }) => `- ${d.title} at ${d.business} | listing_id:${d.listing_id} | ${d.description}`).join('\n')
    )
  }
  return parts.join('\n\n')
}
