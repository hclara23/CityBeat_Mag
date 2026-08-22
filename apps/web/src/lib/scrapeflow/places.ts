// Google Places text search → ExtractedListing[] for the SEARCH_GOOGLE_PLACES
// node. Uses the same legacy Places Web Service endpoints and
// GOOGLE_PLACES_API_KEY as lib/enrich-contacts.ts. Returns REAL place ids so the
// directory doc id matches Google-sourced rows and the enrichment cron.

import type { ExtractedListing } from './types'

const TEXT_SEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const DETAILS = 'https://maps.googleapis.com/maps/api/place/details/json'

export function placesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface RawPlace {
  place_id: string
  name: string
  formatted_address?: string
  geometry?: { location?: { lat: number; lng: number } }
  types?: string[]
  business_status?: string
}

export async function textSearchAll(
  query: string,
  opts: { pages?: number; log?: (m: string) => void } = {}
): Promise<RawPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set')
  const pages = Math.min(3, Math.max(1, opts.pages || 3))
  const out: RawPlace[] = []
  let token: string | null = null
  for (let page = 0; page < pages; page++) {
    const url = new URL(TEXT_SEARCH)
    url.searchParams.set('key', key)
    url.searchParams.set('region', 'us')
    if (token) {
      url.searchParams.set('pagetoken', token)
      // next_page_token becomes valid a couple of seconds after it is issued.
      await sleep(2100)
    } else {
      url.searchParams.set('query', query)
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
    const data: any = await res.json().catch(() => ({}))
    if (data.status === 'INVALID_REQUEST' && token) {
      // Token not ready yet — one retry.
      await sleep(2500)
      const again: any = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) }).then((r) => r.json()).catch(() => ({}))
      if (again.status === 'OK') Object.assign(data, again)
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      opts.log?.(`Places ${data.status}${data.error_message ? `: ${data.error_message}` : ''} for "${query}"`)
      break
    }
    out.push(...((data.results || []) as RawPlace[]))
    token = data.next_page_token || null
    if (!token) break
  }
  return out
}

export async function placeContact(placeId: string): Promise<{ phone: string | null; website: string | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return { phone: null, website: null }
  const url = new URL(DETAILS)
  url.searchParams.set('key', key)
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'formatted_phone_number,website')
  try {
    const data: any = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) }).then((r) => r.json())
    return { phone: data?.result?.formatted_phone_number || null, website: data?.result?.website || null }
  } catch {
    return { phone: null, website: null }
  }
}

function splitAddress(formatted: string | undefined): Pick<ExtractedListing, 'address' | 'city' | 'state' | 'zip'> {
  // "5400 N Mesa St Ste A, El Paso, TX 79912, USA"
  const parts = (formatted || '').replace(/,\s*(USA|United States|México|Mexico)$/i, '').split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return { address: formatted || null, city: null, state: null, zip: null }
  const last = parts[parts.length - 1]
  const m = last.match(/^([A-Z]{2})\s*(\d{5})?/)
  const city = parts.length >= 3 ? parts[parts.length - 2] : null
  const street = parts.slice(0, parts.length >= 3 ? -2 : -1).join(', ')
  return { address: street || null, city, state: m ? m[1] : null, zip: m && m[2] ? m[2] : null }
}

export async function searchPlacesAsListings(
  queries: string[],
  opts: { pages?: number; category?: string | null; fetchDetails?: boolean; detailsCap?: number; log?: (m: string) => void; deadline?: number }
): Promise<ExtractedListing[]> {
  const seen = new Map<string, ExtractedListing>()
  for (const q of queries) {
    if (opts.deadline && Date.now() > opts.deadline) {
      opts.log?.('Time budget reached — stopping query loop')
      break
    }
    const results = await textSearchAll(q, { pages: opts.pages, log: opts.log })
    let fresh = 0
    for (const p of results) {
      if (!p.place_id || !p.name) continue
      if (p.business_status === 'CLOSED_PERMANENTLY') continue
      if (seen.has(p.place_id)) continue
      fresh++
      seen.set(p.place_id, {
        name: p.name,
        category: opts.category || null,
        ...splitAddress(p.formatted_address),
        phone: null,
        website: null,
        email: null,
        description: null,
        source_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        google_place_id: p.place_id,
        latitude: p.geometry?.location?.lat ?? null,
        longitude: p.geometry?.location?.lng ?? null,
      })
    }
    opts.log?.(`"${q}": ${results.length} results, ${fresh} new`)
  }
  if (opts.fetchDetails !== false) {
    const cap = opts.detailsCap ?? 150
    let n = 0
    for (const l of seen.values()) {
      if (n >= cap) break
      if (opts.deadline && Date.now() > opts.deadline) break
      const c = await placeContact(l.google_place_id!)
      l.phone = c.phone
      l.website = c.website
      n++
    }
    opts.log?.(`Fetched contact details for ${n} places`)
  }
  return [...seen.values()]
}
