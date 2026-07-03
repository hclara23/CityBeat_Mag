import { adminDb } from '@citybeat/lib/firebase/admin'

// Backfills contact data for directory listings so the sales agent can reach them.
// Strategy: Google Places Details (place_id → website + phone) when GOOGLE_PLACES_API_KEY
// is set, then scrape the website HTML for a public contact email. Safe no-ops without
// the key (still attempts website-email scrape for listings that already have a website).

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const SKIP_EMAIL = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|@sentry|@example|@2x|wixpress|\.wix)/i

// Stored google_place_id values are OSM ids (osm:node:..), not Google place ids,
// so we resolve a real place id from the business name + address first.
async function findPlaceId(query: string): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key || !query.trim()) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${key}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data: any = await res.json()
    return data?.candidates?.[0]?.place_id || null
  } catch {
    return null
  }
}

async function placesDetails(query: string): Promise<{ website?: string; phone?: string } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return null
  const placeId = await findPlaceId(query)
  if (!placeId) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=website,formatted_phone_number,international_phone_number&key=${key}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data: any = await res.json()
    const r = data?.result || {}
    return { website: r.website, phone: r.formatted_phone_number || r.international_phone_number }
  } catch {
    return null
  }
}

async function fetchPageEmail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'CityBeatBot/1.0' } })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 200000)
    // mailto: links first — least likely to be a false positive.
    const mailto = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
    if (mailto && !SKIP_EMAIL.test(mailto[1])) return mailto[1]
    const matches = html.match(EMAIL_RE) || []
    return matches.find((m) => !SKIP_EMAIL.test(m)) || null
  } catch {
    return null
  }
}

// Small businesses rarely put an email on the homepage — it lives on the
// contact page. Try the homepage, then the common contact/about paths.
async function scrapeEmail(website: string): Promise<string | null> {
  const home = await fetchPageEmail(website)
  if (home) return home
  let origin: string
  try {
    origin = new URL(website).origin
  } catch {
    return null
  }
  for (const path of ['/contact', '/contact-us', '/about']) {
    const found = await fetchPageEmail(`${origin}${path}`)
    if (found) return found
  }
  return null
}

const RETRY_AFTER_MS = 30 * 86400000 // don't re-grind a failed doc for 30 days

export async function runContactEnrichment(opts: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100))
  const stats = { scanned: 0, places_filled: 0, emails_found: 0, updated: 0 }

  // Page through unclaimed listings collecting ones we haven't attempted
  // recently. Without the attempted-marker skip, every run re-scanned the same
  // first page of unenrichable docs and the backlog never advanced.
  const candidates: FirebaseFirestore.QueryDocumentSnapshot[] = []
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
  for (let page = 0; page < 8 && candidates.length < limit * 3; page++) {
    let q = adminDb.collection('directory_listings').where('claim_status', '==', 'unclaimed').limit(500)
    if (cursor) q = q.startAfter(cursor)
    const snap = await q.get()
    if (snap.empty) break
    cursor = snap.docs[snap.docs.length - 1]
    for (const d of snap.docs) {
      const l = d.data() as any
      if (l.email) continue // already contactable
      const attempted = typeof l.enrich_attempted_at === 'string' ? Date.parse(l.enrich_attempted_at) : 0
      if (attempted && Date.now() - attempted < RETRY_AFTER_MS) continue
      candidates.push(d)
      if (candidates.length >= limit * 3) break
    }
    if (snap.size < 500) break
  }

  for (const doc of candidates) {
    if (stats.updated >= limit) break
    const l = doc.data() as any
    stats.scanned++

    const updates: Record<string, any> = {}
    let website = l.website as string | undefined

    if (!website || !l.phone) {
      const query = [l.name, l.address].filter(Boolean).join(' ')
      const details = await placesDetails(query)
      if (details) {
        if (details.website && !l.website) {
          updates.website = details.website
          website = details.website
        }
        if (details.phone && !l.phone) updates.phone = details.phone
        if (Object.keys(updates).length) stats.places_filled++
      }
    }

    if (website) {
      const email = await scrapeEmail(website)
      if (email) {
        updates.email = email
        stats.emails_found++
      }
    }

    // Always stamp the attempt — success or not — so the next run moves on to
    // fresh docs instead of retrying this one for another 30 days.
    updates.enrich_attempted_at = new Date().toISOString()
    if (updates.email || updates.website || updates.phone) {
      updates.enriched_at = new Date().toISOString()
      stats.updated++
    }
    await doc.ref.set(updates, { merge: true })
  }

  return stats
}
