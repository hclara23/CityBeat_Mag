import { adminDb } from '@citybeat/lib/firebase/admin'
import { getCronCursor, setCronCursor } from './cron-cursor'

// Backfills contact data for directory listings so the sales agent can reach them.
// Strategy: read the business's OWN website and take a public contact email off it.
//
// This job used to start from Google Places Details (findplacefromtext → place
// details → website + phone) and write those fields permanently onto the listing.
// That is prohibited twice over by the Google Maps Platform Terms — Content may
// not be cached indefinitely (only the place ID may be kept), and it may not be
// used to build a competing business-listings service, which is exactly what
// /directory is. It also made every Places-derived phone the cold-outreach and
// SMS target, a further prohibited use. The Places path is therefore GONE, not
// TTL'd: a stored copy and a resold copy are separate breaches, and an expiry
// only answers the first.
//
// What remains is lawful and unchanged in kind: a listing that already carries a
// website URL is fetched directly, and a contact address published on that
// business's own pages is stored. Listings with no website are stamped as
// attempted and left for a human or another (non-Google) source.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Reject anything that isn't a real, deliverable business inbox. Sending to
// these wastes outreach and — worse — hurts sender reputation (bounces/spam
// traps), which is why cold outreach was landing nowhere.
const SKIP_EMAIL = new RegExp(
  [
    // asset filenames caught by the regex
    '\\.(png|jpe?g|gif|webp|svg|css|js)$',
    // placeholder / template / example addresses
    '@(example|domain|email|yourdomain|yoursite|company|sentry|test)\\.',
    '^(user|name|email|your|someone|firstname|lastname|john\\.?doe)@',
    // builder / platform / agency inboxes (not the business itself)
    '(wixpress|\\.wix|squarespace|godaddy|wordpress|shopify|typemade|weebly|sentry\\.io|\\.png)',
    // abuse/security role addresses — never a sales contact
    '^(abuse|postmaster|noreply|no-reply|donotreply|mailer-daemon|spam|security)@',
    // image dimension false positives like foo@2x
    '@2x',
  ].join('|'),
  'i'
)

// Role inboxes we'll accept only if nothing better exists (info@, contact@ are
// fine for a small business; we prefer them over generic personal accounts).
function scoreEmail(email: string): number {
  const local = email.split('@')[0].toLowerCase()
  if (/^(info|contact|hello|hi|office|reservations|booking|sales|frontdesk)$/.test(local)) return 2
  if (/(gmail|yahoo|hotmail|outlook|aol|icloud)\.com$/i.test(email)) return 1 // personal, still usable
  return 3 // a named business-domain address — best
}

function bestEmail(candidates: string[], siteHost?: string): string | null {
  const clean = candidates
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@') && !SKIP_EMAIL.test(e))
  if (clean.length === 0) return null
  // Prefer an address on the business's own domain, then by role score.
  const host = (siteHost || '').replace(/^www\./, '')
  const ranked = [...new Set(clean)].sort((a, b) => {
    const aOwn = host && a.endsWith('@' + host) ? 10 : 0
    const bOwn = host && b.endsWith('@' + host) ? 10 : 0
    return bOwn + scoreEmail(b) - (aOwn + scoreEmail(a))
  })
  return ranked[0] || null
}

async function fetchPageEmail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'CityBeatBot/1.0' } })
    if (!res.ok) return null
    const html = (await res.text()).slice(0, 200000)
    let host: string | undefined
    try {
      host = new URL(url).host.replace(/^www\./, '')
    } catch {
      /* ignore */
    }
    const mailtos = [...html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)].map((m) => m[1])
    const inline = html.match(EMAIL_RE) || []
    // mailto links are the strongest signal; fall back to inline text.
    return bestEmail(mailtos, host) || bestEmail(inline, host)
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

export async function runContactEnrichment(opts: { limit?: number; categories?: string[] } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100))
  const catFilter = opts.categories && opts.categories.length ? new Set(opts.categories) : null
  // `places_filled` is deliberately gone from this shape: the Places lookup it
  // counted is gone, and a stat that is always 0 reads like a broken job.
  const stats = { scanned: 0, no_website: 0, emails_found: 0, updated: 0 }

  // Page through unclaimed listings collecting ones we haven't attempted
  // recently. Without the attempted-marker skip, every run re-scanned the same
  // first page of unenrichable docs and the backlog never advanced. An optional
  // category filter lets a run target a specific vertical (e.g. new B2B inventory
  // buried behind thousands of older listings) instead of grinding in order —
  // it's applied in memory (not a query filter), so the traversal itself is the
  // same regardless of whether it's set, which is why one shared cursor works
  // for both a scoped and an unscoped run.
  //
  // The starting point is a cursor PERSISTED ACROSS RUNS, not just within one
  // (see cron-cursor.ts) — without it, every run restarted from the front of
  // Firestore's default doc-ID order and never advanced past the first ~4,000
  // docs, so a whole day's worth of newly-scraped listings (higher-sorting doc
  // ids) could never be reached no matter how many times this ran.
  const cursorName = 'enrich_contacts'
  const startValue = await getCronCursor(cursorName)
  const candidates: FirebaseFirestore.QueryDocumentSnapshot[] = []
  let cursor: string | null = startValue
  let reachedEnd = false
  const maxPages = catFilter ? 30 : 8 // scan deeper when hunting a specific vertical
  for (let page = 0; page < maxPages && candidates.length < limit * 3; page++) {
    let q = adminDb.collection('directory_listings').where('claim_status', '==', 'unclaimed').orderBy('created_at', 'asc').limit(500)
    if (cursor) q = q.startAfter(cursor)
    const snap = await q.get()
    if (snap.empty) {
      reachedEnd = true
      break
    }
    const lastDoc = snap.docs[snap.docs.length - 1]
    cursor = (lastDoc.data() as any)?.created_at || null
    for (const d of snap.docs) {
      const l = d.data() as any
      if (catFilter && !catFilter.has(l.category)) continue
      if (l.email) continue // already contactable
      const attempted = typeof l.enrich_attempted_at === 'string' ? Date.parse(l.enrich_attempted_at) : 0
      if (attempted && Date.now() - attempted < RETRY_AFTER_MS) continue
      candidates.push(d)
      if (candidates.length >= limit * 3) break
    }
    if (snap.size < 500) {
      reachedEnd = true
      break
    }
  }
  await setCronCursor(cursorName, reachedEnd ? null : cursor)

  for (const doc of candidates) {
    if (stats.updated >= limit) break
    const l = doc.data() as any
    stats.scanned++

    const updates: Record<string, any> = {}
    // The listing's OWN website is the only source this job may read. A listing
    // that has none is no longer resolvable through Google Places — that lookup
    // was the licence breach — so it is stamped and skipped rather than filled in.
    const website = typeof l.website === 'string' ? l.website.trim() : ''
    if (website) {
      const email = await scrapeEmail(website)
      if (email) {
        updates.email = email
        stats.emails_found++
      }
    } else {
      stats.no_website++
    }

    // Always stamp the attempt — success or not — so the next run moves on to
    // fresh docs instead of retrying this one for another 30 days.
    updates.enrich_attempted_at = new Date().toISOString()
    if (updates.email) {
      updates.enriched_at = new Date().toISOString()
      stats.updated++
    }
    await doc.ref.set(updates, { merge: true })
  }

  return stats
}
