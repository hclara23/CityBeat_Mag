import { FieldPath } from 'firebase-admin/firestore';
import { cleanListingText } from '@/lib/customer-experience';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@citybeat/lib/firebase/admin';
import { stripInternalListingFields } from '@/lib/listing-fields';
import { activePosts, elPasoDayKey } from '@/lib/listing-content';
import { sponsorshipExpired } from '@/lib/sponsored-rotation';
import { getClientIp, checkRateLimit } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

// Bound response/DOM size; clients can page through every matched result.
const MAX_RESULTS = 24;

// Sort: sponsored first, then featured/premium tier, then rating desc, then
// review count desc, then name asc.
const TIER_RANK: Record<string, number> = { featured: 3, premium: 2, basic: 1 };
function compareListings(a: any, b: any) {
  if (Boolean(a.is_sponsored) !== Boolean(b.is_sponsored)) return a.is_sponsored ? -1 : 1;
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

// Firestore has no substring index. Cache bounded, document-ID-ordered windows
// and expose a continuation cursor rather than silently excluding later records.
// No new search service or subscription is introduced. Existing Firestore usage
// remains metered; future large-scale ingestion should use a dedicated index.
const CORPUS_TTL_MS = 5 * 60 * 1000;
// A window is a memory bound, not a terminal search cap.
const CORPUS_MAX_DOCS = 8000;

type Corpus = { rows: any[]; at: number; nextWindow: string | null };
const corpusCache = new Map<string, Corpus>();

async function getSearchCorpus(category: string, after = ''): Promise<Corpus> {
  const key = `${category || '__all__'}:${after}`;
  const hit = corpusCache.get(key);
  if (hit && Date.now() - hit.at < CORPUS_TTL_MS) return hit;

  let dbQuery: any = adminDb.collection('directory_listings').where('is_published', '==', true);
  if (category) dbQuery = dbQuery.where('category', '==', category);
  dbQuery = dbQuery.orderBy(FieldPath.documentId());
  if (after) dbQuery = dbQuery.startAfter(after);
  const snapshot = await dbQuery.limit(CORPUS_MAX_DOCS + 1).get();
  const docs = snapshot.docs.slice(0, CORPUS_MAX_DOCS);
  const rows = docs.map(toRow);
  const nextWindow = snapshot.docs.length > CORPUS_MAX_DOCS ? docs[docs.length - 1].id : null;

  corpusCache.set(key, { rows, at: Date.now(), nextWindow });
  // Bound the cache's own memory. This trades Firestore reads for RAM, so the
  // ceiling matters on a small container: evict oldest-first past a handful of
  // entries rather than letting every category slug hold a corpus. (Net effect
  // is still far LESS memory than before — every concurrent request used to
  // materialise its own full copy of the collection.)
  while (corpusCache.size > 12) {
    const oldest = [...corpusCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!oldest) break;
    corpusCache.delete(oldest[0]);
  }
  return { rows, at: Date.now(), nextWindow };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Cap the query length: it is only ever used for an in-memory substring match,
  // and an enormous string is pure CPU waste on a public endpoint.
  const query = (searchParams.get('query') || '').slice(0, 100);
  const category = (searchParams.get('category') || '').slice(0, 60);
  const page = Math.min(334, Math.max(0, Number.parseInt(searchParams.get('page') || '0', 10) || 0));
  const after = (searchParams.get('after') || '').slice(0, 1500);
  if (after.includes('/')) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });

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
    const corpus = await getSearchCorpus(category, after);
    let results = expireSponsorship(corpus.rows.map((r) => ({ ...r })));
    if (query) {
      const q = query.trim().toLocaleLowerCase();
      results = results.filter((item: any) => [item.name, item.description, item.address, item.category]
        .some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(q)));
    }
    results.sort(compareListings);
    const total = results.length;
    const hasMore = (page + 1) * MAX_RESULTS < total;
    results = results.slice(page * MAX_RESULTS, (page + 1) * MAX_RESULTS);
    const truncated = hasMore || Boolean(corpus.nextWindow);

    // Strip internal/sensitive fields (contact/stripe ids, verification-bypass
    // token, manager uids) and expose only active posts on every public result.
    const today = elPasoDayKey(new Date());
    const publicResults = results.map((r: any) => {
      const clean = stripInternalListingFields(r);
      if (typeof clean.address === 'string') clean.address = cleanListingText(clean.address);
      if ('posts' in clean) clean.posts = activePosts(clean.posts, today);
      return clean;
    });
    return NextResponse.json({ listings: publicResults, truncated, total, page, hasMore, nextWindow: corpus.nextWindow, searchLimited: Boolean(after || corpus.nextWindow) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
