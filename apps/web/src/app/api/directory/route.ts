import { FieldPath } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { stripInternalListingFields } from '@/lib/listing-fields'
import { activePosts, elPasoDayKey } from '@/lib/listing-content'
import { sponsorshipExpired } from '@/lib/sponsored-rotation'
import { cleanListingText } from '@/lib/customer-experience'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { createDirectoryIndexCache, searchDirectory, SEARCH_MAX_RECORDS, type SearchRow } from '@/lib/directory-search'
import { readDirectoryIndexVersion } from '@/lib/directory-index-version'

export const dynamic = 'force-dynamic'

// Private process-local projection. One shared corpus replaces per-category
// windows. Reads remain metered; review cost/memory before growing beyond 25k.
const getIndex = createDirectoryIndexCache(async (after, limit) => {
  let query = adminDb.collection('directory_listings').where('is_published','==',true)
    .orderBy(FieldPath.documentId()).select('name','description','category','address','locations','tier',
      'is_sponsored','sponsored_until','rating','user_ratings_total','is_published','merged_into',
      'comp_tier','comp_until','stripe_subscription_id')
  if(after) query=query.startAfter(after)
  const snapshot=await query.limit(limit).get()
  return snapshot.docs.map(d=>stripInternalListingFields({...d.data(),id:d.id}) as SearchRow)
}, Date.now, SEARCH_MAX_RECORDS, readDirectoryIndexVersion)

export async function GET(request: NextRequest) {
  const params=request.nextUrl.searchParams
  const rl=await checkRateLimit(`directory-search:ip:${getClientIp(request)}`,{max:120,windowMs:60*1000})
  if(!rl.ok) return NextResponse.json({error:'Too many requests. Please slow down.'},{status:429,headers:{'Retry-After':String(rl.retryAfterSec ?? 30)}})
  try {
    const corpus=await getIndex()
    const result=searchDirectory(corpus.index,{query:(params.get('query')||'').slice(0,100),
      category:(params.get('category')||'').slice(0,60),location:(params.get('location')||'').slice(0,80),
      page:Number(params.get('page')||0)})
    // Current visibility/owner edits win over cached matching data. Only hydrate
    // the selected page; never serve a cached unpublished or merged record.
    const docs=result.ids.length ? await adminDb.getAll(...result.ids.map(id=>adminDb.collection('directory_listings').doc(id))) : []
    const today=elPasoDayKey(new Date())
    const byId=new Map(docs.filter(d=>d.exists).map(d=>[d.id,{...d.data(),id:d.id} as Record<string,any>]))
    const listings=result.ids.flatMap(id=>{
      const row=byId.get(id)
      if(!row || row.is_published!==true || row.merged_into) return []
      const clean=stripInternalListingFields(row)
      if(typeof clean.address==='string') clean.address=cleanListingText(clean.address)
      if('posts' in clean) clean.posts=activePosts(clean.posts,today)
      if(clean.is_sponsored && sponsorshipExpired(clean.sponsored_until)) clean.is_sponsored=false
      return [clean]
    })
    const {ids: _ids,...pageInfo}=result
    return NextResponse.json({listings,...pageInfo,truncated:result.hasMore,nextWindow:null,searchLimited:false,
      indexUpdatedAt:new Date(corpus.at).toISOString(),visibilityChanged:listings.length!==result.ids.length},
      {headers:{'Cache-Control':'no-store'}})
  } catch(error) {
    console.error('Directory search unavailable:',error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({error:'Directory search is temporarily unavailable. Please try again.'},{status:503,headers:{'Retry-After':'30','Cache-Control':'no-store'}})
  }
}
