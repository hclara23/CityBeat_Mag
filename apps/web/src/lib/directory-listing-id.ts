/**
 * A directory listing id as it arrives from a dynamic route segment.
 *
 * WHY THIS EXISTS.
 *
 * Every scraped listing is keyed `sf:<sha1-prefix>` (lib/scrapeflow/normalize.ts),
 * and that colon did not survive the route segment intact on the statically
 * rendered `/[locale]/directory/[id]` page: the Firestore `doc(id)` lookup was
 * handed a form that matched nothing, so EVERY scraped business answered
 * "Business not found" on its own public page. 8,280 published listings, across
 * ten different ScrapeFlow workflows, with examples dating to 2026-08-22 — the
 * majority of the directory's inventory. `/api/directory/[id]`, which is
 * force-dynamic, resolved the identical id correctly the whole time, which is
 * why this never looked like an id problem.
 *
 * Decoding is lossless here because no directory listing id contains a literal
 * '%': they are `sf:` + hex, a Firestore auto-id, or a Google place id drawn
 * from [A-Za-z0-9_-]. When the segment is already decoded this is a no-op, so
 * it is safe to apply unconditionally rather than sniffing for encoding.
 */
export function decodeListingId(raw: string): string {
  const value = String(raw ?? '')
  try {
    // An empty decode result would turn a bad id into a collection read, so
    // fall back to the input rather than returning ''.
    return decodeURIComponent(value) || value
  } catch {
    // A malformed escape sequence ('%zz', a lone '%') throws. A 500 on a
    // hand-typed URL is worse than a miss, so use the input verbatim and let
    // the lookup return null.
    return value
  }
}
