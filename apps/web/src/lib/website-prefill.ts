import { load } from 'cheerio'
import { isIP } from 'node:net'
import { assessLocality } from '@citybeat/lib/directory/quality'
import { isGoogleMapsContent } from './scrapeflow/google-content'

export function publicWebsiteUrl(value: unknown): URL {
  const url = new URL(String(value || ''))
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || isIP(url.hostname) ||
      /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
      isGoogleMapsContent({ source_url: url.href }) || url.href.length > 2000) throw new Error('Use a public HTTPS business website, not a map or private address.')
  url.hash = ''; url.search = ''
  return url
}
export function publicIpv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const [a,b,c] = ip.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 88 && c === 99) ||
    a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
    a === 203 && b === 0 && c === 113)
}
export type PrefillFields = Partial<Record<'name' | 'phone' | 'address' | 'description' | 'website', string>>
export function extractWebsitePrefill(html: string, source: string) {
  const $ = load(html)
  const candidates: Record<string, any>[] = []
  const visit = (value: any, depth = 0) => {
    if (!value || depth > 5 || candidates.length > 30) return
    if (Array.isArray(value)) { value.slice(0,30).forEach(v => visit(v,depth+1)); return }
    if (typeof value !== 'object') return
    if (value.name && (value.address || /Organization|LocalBusiness|Store|Restaurant|Contractor|AutoRepair/i.test(String(value['@type'])))) candidates.push(value)
    if (value['@graph']) visit(value['@graph'],depth+1)
  }
  $('script[type="application/ld+json"]').slice(0,10).each((_i, element) => { try { visit(JSON.parse($(element).text())) } catch {} })
  const unique = [...new Map(candidates.map(c => [String(c.name),c])).values()]
  const business = unique.length === 1 ? unique[0] : {}
  const text = (value: unknown, max: number) => typeof value === 'string' ? load(`<div>${value}</div>`)('div').text().replace(/\s+/g,' ').trim().slice(0,max) : ''
  const fields: PrefillFields = { website: source }
  const warnings = ['Review each selected field before saving. Source content is not independently verified.']
  if (unique.length > 1) warnings.push('Multiple businesses found; ambiguous structured business fields were not selected.')
  const name = text(business.name || $('meta[property="og:site_name"]').attr('content'),120)
  const description = text(business.description || $('meta[name="description"]').attr('content'),1000)
  const phones = [...new Set($('a[href^="tel:"]').map((_i,e)=>$(e).attr('href')!.slice(4).trim()).get())]
  const phone = text(business.telephone || (phones.length===1 ? phones[0] : ''),40)
  if (name) fields.name = name
  if (description) fields.description = description
  if (phone && /^[+()\d .-]{7,40}$/.test(phone)) fields.phone = phone
  const address = business.address
  if (address && typeof address === 'object') {
    const city = text(address.addressLocality,80), state = text(address.addressRegion,30)
    if (assessLocality({city,state}).status === 'inside' && text(address.streetAddress,180)) {
      fields.address = [text(address.streetAddress,180),city,[state,text(address.postalCode,12)].filter(Boolean).join(' ')].join(', ')
    } else warnings.push('Address was omitted because its locality could not be confirmed within the eleven-city service area.')
  }
  return { fields, source_url: source, observed_at: new Date().toISOString(), warnings, review_required: true }
}
