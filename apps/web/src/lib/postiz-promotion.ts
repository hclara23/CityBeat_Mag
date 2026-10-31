import { assessLocality } from '@citybeat/lib/directory/quality'
import { resolveEntitlements } from './directory-entitlements'
export class PromotionError extends Error {constructor(message:string,public status=400){super(message)}}
export function promotionDraft(input:any,listing:Record<string,any>) {
  if(!listing || listing.is_published===false || listing.publication_hold || !resolveEntitlements(listing).socialLinks) throw new PromotionError('Choose a published Premium or Featured listing.',403)
  const locality=assessLocality(listing)
  if(locality.status!=='inside') throw new PromotionError('Confirm this listing is in the eleven-city service area before promoting it.')
  if(!/^[A-Za-z0-9:_-]{1,120}$/.test(input.listing_id || '')) throw new PromotionError('Invalid listing ID.')
  const locale=input.locale==='es'?'es':'en'
  const url=`https://citybeatmag.co/${locale}/directory/${encodeURIComponent(input.listing_id)}`
  const name=String(listing.name || '').replace(/[\x00-\x1f]/g,' ').trim().slice(0,120)
  if(!name) throw new PromotionError('Listing name is missing.')
  const supplied=typeof input.caption==='string'?input.caption.trim():''
  if(supplied.length>1500) throw new PromotionError('Keep the caption under 1,500 characters.')
  let caption=supplied || (locale==='es'?`Conoce ${name} en ${locality.city}. Consulta los detalles y contacta al negocio en CityBeat.`:`Discover ${name} in ${locality.city}. View current details and contact the business on CityBeat.`)
  if(!caption.includes(url)) caption+=`\n\n${url}`
  return {listing_id:input.listing_id,listing_name:name,city:locality.city,locale,caption,url}
}
export function postizConfiguration(env:Record<string,string|undefined>=process.env) {
  const key=env.POSTIZ_API_KEY?.trim()
  if(!key) return null
  const url=new URL(env.POSTIZ_API_URL || 'https://api.postiz.com/public/v1')
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || !url.pathname.replace(/\/$/,'').endsWith('/public/v1')) throw new PromotionError('Postiz connection configuration needs attention.',503)
  return {key,base:url.href.replace(/\/$/,'')}
}
export async function postizRequest(config:NonNullable<ReturnType<typeof postizConfiguration>>,path:'/integrations'|'/posts',body?:unknown,transport:typeof fetch=fetch) {
  const res=await transport(`${config.base}${path}`,{method:body?'POST':'GET',headers:{Authorization:config.key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(10000)})
  if(!res.ok) throw new PromotionError('Postiz did not accept the request.',502)
  return res.json()
}
export function facebookChannels(data:unknown) {
  if(!Array.isArray(data)) throw new PromotionError('Postiz returned an unexpected channel list.',502)
  return data.filter(x=>x && x.identifier==='facebook' && !x.disabled && typeof x.id==='string').slice(0,50).map(x=>({id:x.id,name:String(x.name || 'Facebook page').slice(0,120)}))
}
export function facebookSchedule(caption:string,integration:string,date:string,now=Date.now()) {
  const instant=Date.parse(date)
  if(!Number.isFinite(instant) || instant<now+5*60_000 || instant>now+90*86400_000) throw new PromotionError('Choose a time at least five minutes and at most 90 days from now.')
  if(!integration || integration.length>200 || !caption || caption.length>1800) throw new PromotionError('A connected page and valid caption are required.')
  return {type:'schedule',date:new Date(instant).toISOString(),shortLink:false,tags:[],posts:[{integration:{id:integration},value:[{content:caption,image:[]}],settings:{__type:'facebook'}}]}
}
