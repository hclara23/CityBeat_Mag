import { adminDb } from '@citybeat/lib/firebase/admin'

// Retrieval for the "Ask CityBeat" concierge: grounds chat answers in the real
// directory / events / deals so the model recommends actual local businesses
// (premium first) instead of hallucinating. No vector store — the corpus is a
// few hundred rows, so cached keyword scoring is plenty.

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
const CACHE_MS = 10 * 60 * 1000

async function loadCorpus(): Promise<Corpus> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.corpus

  const [bizSnap, evSnap, dealSnap] = await Promise.all([
    adminDb.collection('directory_listings').where('is_published', '==', true).get().catch(() => ({ docs: [] as any[] })),
    adminDb.collection('events').get().catch(() => ({ docs: [] as any[] })),
    adminDb.collection('deals').get().catch(() => ({ docs: [] as any[] })),
  ])

  const businesses: Biz[] = (bizSnap.docs as any[]).map((d) => {
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
  const events: Ev[] = (evSnap.docs as any[])
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

  const deals: Deal[] = (dealSnap.docs as any[])
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

  const corpus = { businesses, events, deals }
  cache = { at: Date.now(), corpus }
  return corpus
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
