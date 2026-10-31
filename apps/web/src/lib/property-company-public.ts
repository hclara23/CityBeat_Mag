import { cache } from 'react'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { PROPERTY_COMPANIES, getPropertyCompany, type PropertyCompany } from './property-companies'

export function publicCompanyData(id: string, data: Record<string, any>): PropertyCompany | null {
  if (data.status !== 'approved' || typeof data.name !== 'string' || typeof data.website !== 'string') return null
  return { id, name: data.name, website: data.website, aliases: [], portfolioSource: data.website,
    phone: String(data.phone || ''), region: String(data.region || ''),
    inventoryNote: { en: 'Company-submitted portfolio. New property listings are reviewed before paid publication.', es: 'Portafolio proporcionado por la empresa. Las nuevas fichas se revisan antes de su publicación de pago.' } }
}
export const publicPropertyCompanies = cache(async (): Promise<PropertyCompany[]> => {
  try {
    const docs = await adminDb.collection('property_companies').where('status', '==', 'approved').limit(500).get()
    return [...PROPERTY_COMPANIES, ...docs.docs.flatMap(d => { const c = publicCompanyData(d.id, d.data()); return c && !getPropertyCompany(c.id) ? [c] : [] })]
  } catch { return [...PROPERTY_COMPANIES] }
})
export const publicPropertyCompany = cache(async (id: string) => {
  const known = getPropertyCompany(id)
  if (known) return known
  if (!/^[a-z0-9-]{1,100}$/.test(id)) return undefined
  try { const doc = await adminDb.collection('property_companies').doc(id).get(); return publicCompanyData(id, doc.data() || {}) || undefined } catch { return undefined }
})
