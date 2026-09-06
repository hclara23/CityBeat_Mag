import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'

/**
 * Walk a collection in pages, handing each document to `visit`, and never
 * holding more than one page in memory.
 *
 * The admin dashboards used to call `.get()` on whole collections — seven of
 * them in one request on /api/admin/finance — and materialise every document at
 * once. `directory_listings` alone is thousands of rows and grows every night
 * from the scraper, so the peak allocation of a single page load scaled with the
 * size of the business. That is an out-of-memory kill on a 2Gi instance, taking
 * the whole site down with it, not just the admin page.
 *
 * Paging does not reduce Firestore's per-document read BILLING — only reading
 * fewer documents does that — but it does bound memory, and it is what lets a
 * caller accumulate exact totals while keeping just the rows it displays.
 *
 * `cap` is a backstop against a runaway collection: `truncated` comes back true
 * if it was reached, so a caller can say so rather than quietly reporting a
 * total computed from part of the data.
 */
export async function scanCollection(
  query: Query,
  visit: (doc: QueryDocumentSnapshot) => void,
  options: { pageSize?: number; cap?: number } = {}
): Promise<{ scanned: number; truncated: boolean }> {
  const pageSize = Math.max(1, options.pageSize ?? 500)
  const cap = Math.max(0, options.cap ?? 50_000)

  let cursor: QueryDocumentSnapshot | null = null
  let scanned = 0

  while (scanned < cap) {
    const page: Query = cursor ? query.startAfter(cursor).limit(pageSize) : query.limit(pageSize)
    const snap = await page.get()
    if (snap.empty) return { scanned, truncated: false }
    for (const doc of snap.docs) {
      visit(doc)
      scanned++
    }
    if (snap.docs.length < pageSize) return { scanned, truncated: false }
    cursor = snap.docs[snap.docs.length - 1]
  }
  return { scanned, truncated: true }
}

/**
 * Keeps only the `limit` largest items by `score`, for building a "most recent
 * N" list out of a stream without sorting the whole collection. Insertion into a
 * short array beats sorting thousands of rows we are about to discard.
 */
export class TopN<T> {
  private readonly items: Array<{ score: string; value: T }> = []

  constructor(private readonly limit: number) {}

  add(score: string, value: T): void {
    if (this.items.length >= this.limit && score <= this.items[this.items.length - 1].score) return
    let lo = 0
    let hi = this.items.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.items[mid].score >= score) lo = mid + 1
      else hi = mid
    }
    this.items.splice(lo, 0, { score, value })
    if (this.items.length > this.limit) this.items.pop()
  }

  values(): T[] {
    return this.items.map((item) => item.value)
  }
}
