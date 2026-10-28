import { DIRECTORY_CATEGORIES, categoryLabel } from './categories'
import { sponsorshipExpired } from './sponsored-rotation'

export const SEARCH_PAGE_SIZE = 24
// Safety ceiling, NOT a partial-results window. Larger inventories fail closed
// until capacity is deliberately increased/replaced after cost/memory review.
export const SEARCH_MAX_RECORDS = 25_000
export const SEARCH_TTL_MS = 15 * 60 * 1000
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
/** Single-flight, shared cache. Internal pages are not user-facing windows. */
export function createDirectoryIndexCache(loadPage:(after:string|null,limit:number)=>Promise<SearchRow[]>,now=Date.now,max=SEARCH_MAX_RECORDS) {
  let cached:{index:SearchEntry[];at:number}|undefined
  let pending:Promise<{index:SearchEntry[];at:number}>|undefined
  return async()=>{
    if(cached && now()-cached.at<SEARCH_TTL_MS) return cached
    if(pending) return pending
    pending=(async()=>{
      const rows:SearchRow[]=[];let after:string|null=null
      for(;;) {
        const limit=Math.min(1000,max-rows.length+1),batch=await loadPage(after,limit)
        if(batch.some((r,i)=>!r.id || r.id<=(i?batch[i-1].id:after||''))) throw new Error('Invalid directory index cursor')
        rows.push(...batch)
        if(rows.length>max) throw new Error('Directory index capacity exceeded')
        if(batch.length<limit) break
        after=batch[batch.length-1].id
      }
      cached={index:buildSearchIndex(rows),at:now()};return cached
    })()
    try{return await pending}finally{pending=undefined}
  }
}
