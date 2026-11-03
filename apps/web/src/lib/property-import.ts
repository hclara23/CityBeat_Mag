import { load } from 'cheerio'
import { PROPERTY_TYPES, type CommunityType } from './apartments'

export const IMPORT_FIELDS = ['name', 'property_type', 'address', 'city', 'state', 'zip', 'phone', 'website', 'description', 'description_es'] as const
export type ImportField = typeof IMPORT_FIELDS[number]
export type PropertyImportFields = Record<ImportField, string>
export type ImportSource = { kind: 'website' | 'brochure'; label: string; sha256: string; observed_at: string }
export type ImportDraft = { fields: PropertyImportFields; source: ImportSource; evidence: Record<string, string[]>;
  photos: string[]; text: string; warnings: string[]; generation: 'fact_template' | 'ai_draft' }
export const blankImportFields = (): PropertyImportFields => Object.fromEntries(IMPORT_FIELDS.map(k => [k, ''])) as PropertyImportFields
const clean = (value: unknown, max = 4000) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : ''
export function importPhotoUrl(value: unknown): string | null {
  try { const u = new URL(String(value)); return u.protocol === 'https:' && !u.username && !u.password && !u.port && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) && !/(?:^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname) && u.href.length <= 1500 ? u.href : null } catch { return null }
}
const labels: Partial<Record<ImportField, string[]>> = {
  name: ['Property', 'Property name', 'Community', 'Community name', 'Nombre', 'Propiedad', 'Comunidad'],
  address: ['Address', 'Street address', 'Dirección'], city: ['City', 'Ciudad'], state: ['State', 'Estado'],
  zip: ['ZIP', 'ZIP code', 'Postal code', 'Código postal'], phone: ['Phone', 'Leasing phone', 'Teléfono'],
  website: ['Website', 'Sitio web'], description: ['English description', 'Description EN'], description_es: ['Spanish description', 'Descripción ES'],
  property_type: ['Property type', 'Tipo de propiedad'],
}
/** Conservative non-AI extraction. Conflicting values are kept as evidence, never silently chosen. */
export function extractPropertyDraft(input: { text: string; html?: string; source: ImportSource }): ImportDraft {
  const fields = blankImportFields(), evidence: Record<string, string[]> = {}, warnings: string[] = []
  const add = (key: ImportField, value: unknown) => {
    const v = clean(value, key.startsWith('description') ? 4000 : 500)
    if (v) evidence[key] = [...new Set([...(evidence[key] || []), v])]
  }
  const text = clean(input.text, 40000)
  // PDF extraction can flatten adjacent labelled lines into one paragraph. Split only
  // recognized labels, preserving the original text below as reviewer evidence.
  const knownLabels = [...Object.values(labels).flat(), 'Amenities', 'Amenidades', 'Servicios'].sort((a, b) => b.length - a.length).join('|')
  const labelledText = text.replace(new RegExp(`\\s+(?=(?:${knownLabels})\\s*:)`, 'gi'), '\n')
  for (const [key, names] of Object.entries(labels)) {
    const re = new RegExp(`^\\s*(?:${names.join('|')})\\s*:\\s*(.+)$`, 'gim')
    for (const match of labelledText.matchAll(re)) add(key as ImportField, match[1])
  }
  const photos: string[] = []
  if (input.html) {
    const $ = load(input.html)
    const candidates: any[] = []
    const visit = (v: any, depth = 0) => {
      if (!v || depth > 5 || candidates.length >= 25) return
      if (Array.isArray(v)) { v.slice(0, 25).forEach(x => visit(x, depth + 1)); return }
      if (typeof v !== 'object') return
      if (v.name && v.address && /Apartment|Residence|House|RealEstate|LocalBusiness|Lodging/i.test(String(v['@type']))) candidates.push(v)
      if (v['@graph']) visit(v['@graph'], depth + 1)
    }
    $('script[type="application/ld+json"]').slice(0, 10).each((_, el) => { try { visit(JSON.parse($(el).text())) } catch {} })
    const unique = [...new Map(candidates.map(c => [JSON.stringify([c.name, c.address]), c])).values()]
    if (unique.length === 1) {
      const p = unique[0], a = p.address
      add('name', p.name); add('phone', p.telephone)
      if (typeof a === 'object') { add('address', a.streetAddress); add('city', a.addressLocality); add('state', a.addressRegion); add('zip', a.postalCode) }
      if (/Apartment/i.test(String(p['@type']))) add('property_type', 'apartments')
      if (/SingleFamilyResidence/i.test(String(p['@type']))) add('property_type', 'single-family')
    } else if (unique.length > 1) warnings.push('multiple_properties')
    const sourceUrl = input.source.kind === 'website' ? input.source.label : undefined
    const imageValues = [$('meta[property="og:image"]').attr('content'), ...$('img[src]').slice(0, 80).map((_, e) => $(e).attr('src')).get()]
    for (const value of imageValues) {
      try { const url = importPhotoUrl(new URL(value || '', sourceUrl).href); if (value && url && !photos.includes(url)) photos.push(url) } catch {}
      if (photos.length >= 15) break
    }
  }
  for (const key of IMPORT_FIELDS) {
    if (evidence[key]?.length === 1) fields[key] = evidence[key][0]
    if ((evidence[key]?.length || 0) > 1) warnings.push(`conflict:${key}`)
  }
  if (input.source.kind === 'website' && !fields.website) fields.website = input.source.label
  if (!Object.prototype.hasOwnProperty.call(PROPERTY_TYPES, fields.property_type)) fields.property_type = ''
  const type = PROPERTY_TYPES[fields.property_type as CommunityType] || { en: 'Rental property', es: 'Propiedad de alquiler' }
  const amenityLabels: Record<string, [string, string]> = { pool: ['Pool', 'Alberca'], 'fitness center': ['Fitness center', 'Gimnasio'],
    'dog park': ['Dog park', 'Parque para perros'], 'pet friendly': ['Pet friendly', 'Admite mascotas'],
    laundry: ['Laundry facilities', 'Lavandería'], parking: ['Parking', 'Estacionamiento'] }
  // Only explicit amenity-list entries qualify: prose/negations are not interpreted as claims.
  const amenityLines = [...labelledText.matchAll(/^\s*(?:Amenities|Amenidades|Servicios)\s*:\s*(.+)$/gim)].flatMap(m => m[1].split(/[,;|]/).map(v => v.trim().toLowerCase()))
  const amenities = [...new Set(amenityLines)].flatMap(v => amenityLabels[v] ? [amenityLabels[v]] : [])
  if (amenities.length) evidence.amenities = amenities.map(a => a[0])
  // Factual templates are explicitly labelled; they are not translations of source prose.
  const location = [fields.address, fields.city, fields.state, fields.zip].filter(Boolean).join(', ')
  if (!fields.description) fields.description = [fields.name && `${fields.name}.`, location && `${type.en}: ${location}.`, amenities.length && `Listed amenities: ${amenities.map(a => a[0]).join(', ')}.`, 'Contact the leasing team to confirm availability, pricing and terms.'].filter(Boolean).join(' ')
  if (!fields.description_es) fields.description_es = [fields.name && `${fields.name}.`, location && `${type.es}: ${location}.`, amenities.length && `Amenidades indicadas: ${amenities.map(a => a[1]).join(', ')}.`, 'Contacte al equipo de arrendamiento para confirmar disponibilidad, precios y condiciones.'].filter(Boolean).join(' ')
  warnings.push('review_sources', 'fact_template', 'photo_rights')
  if (input.source.kind === 'brochure') warnings.push('brochure_photos_manual')
  return { fields, source: input.source, evidence, text, photos, warnings, generation: 'fact_template' }
}

export function duplicateImportCandidates(fields: Pick<PropertyImportFields, 'name' | 'address' | 'city' | 'zip'>, listings: { id: string; name?: string; address?: string; city?: string; zip?: string }[]) {
  const normal = (v: unknown) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return listings.filter(p => (normal(fields.address) && normal(p.address) === normal(fields.address) &&
    ((normal(fields.city) && normal(p.city) === normal(fields.city)) || (normal(fields.zip) && normal(p.zip) === normal(fields.zip)))) ||
    (normal(fields.name) && normal(p.name) === normal(fields.name))).map(p => ({ id: p.id, name: p.name || p.id }))
}
