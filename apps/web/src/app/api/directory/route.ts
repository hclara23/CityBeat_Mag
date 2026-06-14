import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@citybeat/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || '';

  let dbQuery: any = adminDb.collection('directory_listings').where('is_published', '==', true);

  if (category) {
    dbQuery = dbQuery.where('category', '==', category);
  }

  // To support multi-field sorting, we pull the results down and sort in memory 
  // since Firestore requires composite indexes for complex multi-field orderBys.
  // We also do the text-search filter in memory since Firestore doesn't support substring match natively.
  try {
    const snapshot = await dbQuery.get();
    
    let results = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    if (query) {
      const q = query.toLowerCase();
      results = results.filter((item: any) => 
        (item.name?.toLowerCase().includes(q)) ||
        (item.description?.toLowerCase().includes(q)) ||
        (item.address?.toLowerCase().includes(q))
      );
    }

    // Sort: Sponsored first, then Premium tier first, then by rating desc, then by review count desc, then name asc
    results.sort((a: any, b: any) => {
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      if (a.tier !== b.tier) {
         // Assuming tier is like 'premium', 'standard', 'free'
         const tierRank = { 'premium': 3, 'standard': 2, 'free': 1 } as any;
         const aTier = tierRank[a.tier] || 0;
         const bTier = tierRank[b.tier] || 0;
         if (aTier !== bTier) return bTier - aTier;
      }
      if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      if ((a.user_ratings_total || 0) !== (b.user_ratings_total || 0)) return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
      return (a.name || '').localeCompare(b.name || '');
    });

    return NextResponse.json({ listings: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
