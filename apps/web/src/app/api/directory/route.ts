import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@citybeat/lib/firebase/admin';
import { stripInternalListingFields } from '@/lib/listing-fields';
import { activePosts, elPasoDayKey } from '@/lib/listing-content';
import { sponsorshipExpired } from '@/lib/sponsored-rotation';

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
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

  try {
    let results: any[];

    if (!query && !category) {
      results = expireSponsorship(await fetchDefaultView());
      results.sort(compareListings);
    } else {
      // To support multi-field sorting, we pull the results down and sort in
      // memory since Firestore requires composite indexes for complex multi-
      // field orderBys. We also do the text-search filter in memory since
      // Firestore doesn't support substring match natively.
      let dbQuery: any = adminDb.collection('directory_listings').where('is_published', '==', true);
      if (category) dbQuery = dbQuery.where('category', '==', category);
      const snapshot = await dbQuery.get();
      results = expireSponsorship(snapshot.docs.map(toRow));

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
