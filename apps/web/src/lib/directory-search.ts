import { DIRECTORY_CATEGORIES, categoryLabel } from './categories'
import { sponsorshipExpired } from './sponsored-rotation'

export const SEARCH_PAGE_SIZE = 24
// Safety ceiling, NOT a partial-results window. Larger inventories fail closed
// until capacity is deliberately increased/replaced after cost/memory review.
export const SEARCH_MAX_RECORDS = 25_000
// Every rebuild re-reads every published row (~11k metered reads today), so these
// three numbers ARE the Firestore bill. At the old 15-minute clock that was ~96
// rebuilds/day (~1M reads, ~$19/month: about four-fifths of measured Firestore
// spend in October 2026) for a directory whose rows change a few times a day.
// Safe to lengthen because results are re-hydrated from live documents before
// they are returned (app/api/directory/route.ts): a stale index can only mis-match
// or mis-rank, never mis-display or serve an unpublished row. Writers that change
// matching/ranking bump a version marker, which pulls a rebuild forward.
export const SEARCH_TTL_MS = 6 * 60 * 60 * 1000
export const SEARCH_MIN_REBUILD_MS = 15 * 60 * 1000
export const SEARCH_PROBE_EVERY_MS = 60 * 1000
export const normalizeSearch = (value: unknown): string => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f\uE000-\uF8FF]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const aliases: Record<string, string> = {
  'electrical contractor':'Electrical Contractors', 'marketing agency':'Marketing',
  'real estate realtor':'Real Estate', 'roofing construction':'Home Services',
  'property services':'Home Services', 'cpa accounting services':'Financial',
  'merchant services':'Financial', 'martial arts':'Fitness', 'meat market':'Retail',
}
export function searchCategory(value: unknown): string {
  const key=normalizeSearch(value)
  return DIRECTORY_CATEGORIES.find(c=>normalizeSearch(c)===key || normalizeSearch(categoryLabel(c,'es'))===key)
    || aliases[key] || String(value || '')
}
export interface SearchRow {
  id:string; name?:string; description?:string; category?:string; address?:string
  locations?:Array<{address?:string|null}>; tier?:string; is_sponsored?:boolean
  sponsored_until?:unknown; rating?:number; user_ratings_total?:number
  is_published?:boolean; merged_into?:unknown
}
export interface SearchEntry {row:SearchRow; text:string; category:string; addresses:string[]}
export function buildSearchIndex(rows:SearchRow[]):SearchEntry[] {
  return rows.filter(r=>r.is_published===true && !r.merged_into).map(row=>{
    const category=searchCategory(row.category)
    const addresses=[row.address,...(Array.isArray(row.locations)?row.locations.map(l=>l.address):[])].filter(Boolean).map(String)
    return {row,category,addresses,text:normalizeSearch([row.name,row.description,row.category,category,categoryLabel(category,'es'),...addresses].join(' '))}
  })
}
function matchesLocation(address:string,location:string):boolean {
  // `(?:-?\d{4})?` rather than `(?:-\d{4})?`: 603 published listings are already
  // stored with a glued ZIP+4 ("El Paso, TX 799367634") from the TABC import.
  // formatAddress no longer produces that form, but tolerating it here makes
  // every existing row findable immediately instead of after a data backfill —
  // and these are restaurants and bars, the highest-intent category, which a
  // search box labelled "City or ZIP code" simply could not find.
  if(/^\d{5}$/.test(location)) return address.match(/\b(?:TX|Texas|NM|New Mexico)\s*,?\s*(\d{5})(?:-?\d{4})?\b/i)?.[1]===location
  // Locality after the first comma, not a street named El Paso.
  const locality=normalizeSearch(address.includes(',')?address.slice(address.indexOf(',')+1):address)
  return (` ${locality} `).includes(` ${location} `)
}
export function searchDirectory(index:SearchEntry[],options:{query?:string;category?:string;location?:string;page?:number},now=new Date()) {
  const terms=normalizeSearch(options.query).split(' ').filter(Boolean)
  const category=normalizeSearch(searchCategory(options.category)),location=normalizeSearch(options.location)
  const found=index.filter(e=>(!category || normalizeSearch(e.category)===category)
    && terms.every(t=>e.text.includes(t)) && (!location || e.addresses.some(a=>matchesLocation(a,location))))
  const tier:Record<string,number>={featured:3,premium:2,basic:1}
  const sponsored=(r:SearchRow)=>Boolean(r.is_sponsored && !sponsorshipExpired(r.sponsored_until,now))
  found.sort((a,b)=>Number(sponsored(b.row))-Number(sponsored(a.row))
    || (tier[b.row.tier||'']||0)-(tier[a.row.tier||'']||0)
    || (b.row.rating||0)-(a.row.rating||0) || (b.row.user_ratings_total||0)-(a.row.user_ratings_total||0)
    || String(a.row.name||'').localeCompare(String(b.row.name||'')) || a.row.id.localeCompare(b.row.id))
  const total=found.length,pageCount=Math.ceil(total/SEARCH_PAGE_SIZE)
  const requested=Number.isFinite(options.page)?Math.max(0,Math.floor(options.page!)):0
  const page=Math.min(requested,Math.max(0,pageCount-1))
  return {ids:found.slice(page*SEARCH_PAGE_SIZE,(page+1)*SEARCH_PAGE_SIZE).map(e=>e.row.id),total,page,pageCount,hasMore:page+1<pageCount}
}
/** Single-flight, shared cache. Internal pages are not user-facing windows.
 *
 *  Freshness has three layers, cheapest first:
 *   - SEARCH_TTL_MS      the hard ceiling: nothing older than this is ever served.
 *   - the version probe  `probe()` returns a marker that writers bump when search
 *                        data changes (lib/directory-index-version.ts). Once the
 *                        index is SEARCH_MIN_REBUILD_MS old, a changed marker
 *                        rebuilds early. Probed at most once per
 *                        SEARCH_PROBE_EVERY_MS, so it costs ~1 read a minute
 *                        against ~11k for a rebuild.
 *   - the rebuild floor  a bump cannot trigger a rebuild sooner than the floor,
 *                        so a burst of writes (an ingest, a bulk publish) costs
 *                        one rebuild, not one per write.
 *  A probe that fails keeps serving what it has: "could not check" is not "changed". */
export function createDirectoryIndexCache(loadPage:(after:string|null,limit:number)=>Promise<SearchRow[]>,now=Date.now,max=SEARCH_MAX_RECORDS,probe?:()=>Promise<string>) {
  type Cached={index:SearchEntry[];at:number;version:string|null}
  let cached:Cached|undefined
  let pending:Promise<Cached>|undefined
  let probedAt=-Infinity
  const readVersion=async():Promise<string|null|undefined>=>{
    if(!probe) return null
    try{return await probe()}catch{return undefined}
  }
  return async()=>{
    if(cached) {
      const age=now()-cached.at
      if(age<SEARCH_TTL_MS) {
        if(!probe || age<SEARCH_MIN_REBUILD_MS || now()-probedAt<SEARCH_PROBE_EVERY_MS) return cached
        probedAt=now()
        const v=await readVersion()
        if(v===undefined || v===cached.version) return cached
      }
    }
    if(pending) return pending
    pending=(async()=>{
      // Read the marker BEFORE loading: a bump that lands mid-load then reads as
      // newer than this build on the next probe, instead of being absorbed by it.
      const version=(await readVersion()) ?? null
      const rows:SearchRow[]=[];let after:string|null=null
      for(;;) {
        const limit=Math.min(1000,max-rows.length+1),batch=await loadPage(after,limit)
        if(batch.some((r,i)=>!r.id || r.id<=(i?batch[i-1].id:after||''))) throw new Error('Invalid directory index cursor')
        rows.push(...batch)
        if(rows.length>max) throw new Error('Directory index capacity exceeded')
        if(batch.length<limit) break
        after=batch[batch.length-1].id
      }
      cached={index:buildSearchIndex(rows),at:now(),version};return cached
    })()
    try{return await pending}finally{pending=undefined}
  }
}
