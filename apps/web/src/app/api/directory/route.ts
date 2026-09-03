import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@citybeat/lib/firebase/admin';
import { stripInternalListingFields } from '@/lib/listing-fields';
import { activePosts, elPasoDayKey } from '@/lib/listing-content';
import { sponsorshipExpired } from '@/lib/sponsored-rotation';
import { getClientIp, checkRateLimit } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

// Directory inventory crossed ~6,700 published listings after the 2026-08-22/23
// scraping sweeps. An uncapped response for a broad/no-category search was
// serializing the ENTIRE published collection (4.7MB, ~5s) and the client was
// then mounting one DOM card + one map marker per row with no pagination —
// which is what actually made search "not work" (the page hung, not the API).
// Capping post-sort keeps sponsored/premium listings (they sort first) while
// bounding payload and render cost; a category filter already narrows the
// Firestore read itself, so this mostly matters for the all-categories case.
const MAX_RESULTS = 200;

// Sort: sponsored first, then featured/premium tier, then rating desc, then
// review count desc, then name asc.
const TIER_RANK: Record<string, number> = { featured: 3, premium: 2, basic: 1 };
function compareListings(a: any, b: any) {
  if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
  const aTier = TIER_RANK[a.tier] || 0;
  const bTier = TIER_RANK[b.tier] || 0;
  if (aTier !== bTier) return bTier - aTier;
  if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0);
  if ((a.user_ratings_total || 0) !== (b.user_ratings_total || 0)) return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
  return (a.name || '').localeCompare(b.name || '');
}

function expireSponsorship(docs: any[]) {
  const now = new Date();
  for (const item of docs) {
    if (item.is_sponsored && sponsorshipExpired(item.sponsored_until, now)) item.is_sponsored = false;
  }
  return docs;
}

const toRow = (doc: any) => ({ id: doc.id, ...doc.data() });

// The bare landing view (no category, no search text) is by far the most
// common request and used to be the single worst case: a full 6,700+ doc
// Firestore read + in-memory sort on every load. There's no Firestore-native
// way to replicate the multi-field sort above in one query, but sponsored and
// featured/premium listings are a small, bounded slice of the catalog — so
// fetch just those natively (cheap, indexed) plus a capped, rating-ordered
// slice of everyone else, instead of reading the whole collection to sort 60
// rows out of it. A category filter already scopes the Firestore read itself
// (a few hundred to ~1,600 docs, not 6,700+), so it keeps the original
// full-fetch-and-sort path; free-text search has no Firestore-native answer
// without a real search index (Algolia/Typesense) — a separate, larger fix.
const BASIC_SLICE_LIMIT = 200;

// ── Search corpus cache ──────────────────────────────────────────────────────
// Free-text search has no Firestore-native answer (no substring index), so the
// matching happens in memory — which meant EVERY search read the whole published
// collection. At ~6,700 listings that is 6,700 billed document reads per
// keystroke-pause, from a public unauthenticated endpoint. It was the single
// largest line on the Firestore bill and it scales linearly with traffic, so a
// successful promotion would have multiplied it directly.
//
// Firestore bills per document READ regardless of projection, so .select() saves
// bandwidth but not money. The only levers are reading fewer docs or reading less
// often. This caches the corpus per category for a few minutes: the first search
// pays the read, every search after it is free. Under sustained traffic — exactly
// when cost matters — instances stay warm and the hit rate approaches 100%.
const CORPUS_TTL_MS = 5 * 60 * 1000;
// Hard backstop so an unbounded collection can never OOM the container. Well
// above current inventory; if it is ever hit, search needs a real index.
const CORPUS_MAX_DOCS = 8000;

type Corpus = { rows: any[]; at: number };
const corpusCache = new Map<string, Corpus>();

async function getSearchCorpus(category: string): Promise<any[]> {
  const key = category || '__all__';
  const hit = corpusCache.get(key);
  if (hit && Date.now() - hit.at < CORPUS_TTL_MS) return hit.rows;

  let dbQuery: any = adminDb.collection('directory_listings').where('is_published', '==', true);
  if (category) dbQuery = dbQuery.where('category', '==', category);
  const snapshot = await dbQuery.limit(CORPUS_MAX_DOCS).get();
  const rows = snapshot.docs.map(toRow);

  corpusCache.set(key, { rows, at: Date.now() });
  // Bound the cache itself: one entry per category plus the all-categories view.
  if (corpusCache.size > 40) {
    const oldest = [...corpusCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) corpusCache.delete(oldest[0]);
  }
  return rows;
}

async function fetchDefaultView(): Promise<any[]> {
  const base = adminDb.collection('directory_listings').where('is_published', '==', true);
  const [sponsoredSnap, premiumSnap, featuredSnap, basicSnap] = await Promise.all([
    base.where('is_sponsored', '==', true).get(),
    base.where('tier', '==', 'premium').orderBy('rating', 'desc').limit(BASIC_SLICE_LIMIT).get(),
    base.where('tier', '==', 'featured').orderBy('rating', 'desc').limit(BASIC_SLICE_LIMIT).get(),
    base.where('tier', '==', 'basic').orderBy('rating', 'desc').limit(BASIC_SLICE_LIMIT).get(),
  ]);
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const snap of [sponsoredSnap, premiumSnap, featuredSnap, basicSnap]) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      merged.push(toRow(doc));
    }
  }
  return merged;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Cap the query length: it is only ever used for an in-memory substring match,
  // and an enormous string is pure CPU waste on a public endpoint.
  const query = (searchParams.get('query') || '').slice(0, 100);
  const category = (searchParams.get('category') || '').slice(0, 60);

  // Public, unauthenticated, and fired on every keystroke pause by the UI — so it
  // gets a limit. Generous enough that real browsing never trips it.
  const rl = await checkRateLimit(`directory-search:ip:${getClientIp(request)}`, {
    max: 120,
    windowMs: 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 30) } }
    );
  }

  try {
    let results: any[];

    if (!query && !category) {
      results = expireSponsorship(await fetchDefaultView());
      results.sort(compareListings);
    } else {
      // Multi-field sorting and substring matching both have to happen in memory
      // (Firestore supports neither natively), so this works over a cached,
      // capped corpus instead of re-reading the collection on every request.
      // expireSponsorship mutates its input, so copy the cached rows first —
      // otherwise it would permanently clear is_sponsored in the cache.
      const corpus = await getSearchCorpus(category);
      results = expireSponsorship(corpus.map((r) => ({ ...r })));

      if (query) {
        const q = query.toLowerCase();
        results = results.filter((item: any) =>
          (item.name?.toLowerCase().includes(q)) ||
          (item.description?.toLowerCase().includes(q)) ||
          (item.address?.toLowerCase().includes(q))
        );
      }

      results.sort(compareListings);
    }

    const truncated = results.length > MAX_RESULTS;
    if (truncated) results = results.slice(0, MAX_RESULTS);

    // Strip internal/sensitive fields (contact/stripe ids, verification-bypass
    // token, manager uids) and expose only active posts on every public result.
    const today = elPasoDayKey(new Date());
    const publicResults = results.map((r: any) => {
      const clean = stripInternalListingFields(r);
      if ('posts' in clean) clean.posts = activePosts(clean.posts, today);
      return clean;
    });
    return NextResponse.json({ listings: publicResults, truncated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
