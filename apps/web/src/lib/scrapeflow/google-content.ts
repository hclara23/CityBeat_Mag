// Google Maps Platform Content guard for the directory sink.
//
// The sink used to persist WHOLE Places records — name, formatted address,
// lat/lng, and (via Place Details) phone + website — into `directory_listings`
// forever, keyed by the real place id, then published them at /directory and
// sold $9.99-$99/mo claims on them. One write, two Google Maps Platform terms
// breached at once:
//   - No Scraping / No Caching (§3.2.3): the place ID is the only field that may
//     be stored indefinitely; every other field is a temporary cache at best.
//   - No Re-Creating Google Products or Features (§3.2.4): a business-listings
//     or place-search service is named explicitly — which is what /directory is.
// A TTL would answer the first term and not the second, so Places-derived rows
// are REFUSED rather than expired.
//
// The test is PROVENANCE, not shape: the same name/address/phone obtained from
// an open-data feed (TDLR, TSBDE) or from the business's own website is ours to
// keep and must keep flowing. A false positive costs one directory row; a false
// negative is a licence breach whose remedy is Google killing
// GOOGLE_PLACES_API_KEY — which also feeds the enrichment cron and the sales
// pipeline — so the predicate deliberately errs toward refusing.

/** Rows minted by normalize.ts get an `sf:<sha1>` id and carry no Google Content. */
const SYNTHETIC_ID = /^sf:/

// normalize.ts only puts a non-synthetic id on a candidate when the extractor
// supplied a `google_place_id` that looks like a real Places id ("ChIJ…",
// "EipN…", "GhIJ…"), i.e. when a SEARCH_GOOGLE_PLACES node produced the row.
// Matching that same shape here keeps the two files agreeing about what a place
// id is; anything else is a synthetic or foreign id and is left alone.
const PLACE_ID = /^[A-Za-z0-9_-]{10,}$/

function isGoogleHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    // Anchored on the registrable suffix (google.com, google.com.mx, google.co.uk)
    // so a lookalike like "google.com.example.net" is NOT treated as Google.
    return /(^|\.)google\.[a-z]{2,6}(\.[a-z]{2,3})?$/.test(host) || host === 'goo.gl' || host.endsWith('.goo.gl')
  } catch {
    return false
  }
}

/**
 * Is this candidate built from Google Maps Platform Content?
 *
 * True for anything a Places search produced: places.ts stamps every row with a
 * `https://www.google.com/maps/place/?q=place_id:<id>` source_url AND the real
 * place id, and either signal alone is enough — a row that arrived by some other
 * route but still carries a Google place id was still derived from Google.
 */
export function isGoogleMapsContent(row: {
  google_place_id?: string | null
  source_url?: string | null
}): boolean {
  const source = typeof row.source_url === 'string' ? row.source_url.trim() : ''
  if (source && isGoogleHost(source)) return true
  const id = typeof row.google_place_id === 'string' ? row.google_place_id.trim() : ''
  if (!id || SYNTHETIC_ID.test(id)) return false
  return PLACE_ID.test(id)
}
