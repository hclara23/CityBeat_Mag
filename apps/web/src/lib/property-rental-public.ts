import { PROPERTY_TYPES, type ApartmentCommunity, type CommunityType } from './apartments'
import type { PropertyCompany } from './property-companies'
import { safePropertyUrl } from './property-portfolio-policy'

/** Explicit public projection: never expose corporate billing or staff details. */
export function publicRentalFromListing(id: string, data: Record<string, any>, company?: PropertyCompany): ApartmentCommunity | null {
  if (!company || data.property_review !== 'approved' || data.claim_status !== 'approved' || !data.owner_id ||
    data.property_account_id !== company.id || !data.property_custom || data.property_portfolio_paid !== true ||
    data.tier !== 'premium' || data.is_published !== true || !Object.prototype.hasOwnProperty.call(PROPERTY_TYPES, data.property_type)) return null
  if (!['name', 'address', 'city', 'state', 'zip'].every(key => typeof data[key] === 'string' && data[key].trim())) return null
  const phone = String(data.phone || '').replace(/\D/g, '').match(/^(?:1)?([2-9]\d{2}[2-9]\d{6})$/)?.[1]
  if (!phone) return null
  return { slug: id, name: data.name, address: data.address, city: data.city, state: data.state, zip: data.zip, phone,
    website: typeof data.website === 'string' && safePropertyUrl(data.website) ? data.website : company.website,
    companyId: company.id, companyDetails: company, source: company.website, submitted: true, type: data.property_type as CommunityType,
    summary: { en: typeof data.description === 'string' && data.description ? data.description : `${data.name}: contact management for rental availability and terms.`,
      es: typeof data.description_es === 'string' && data.description_es ? data.description_es : `${data.name}: contacte a la administración para conocer disponibilidad y condiciones de alquiler.` },
    highlights: { en: [], es: [] } }
}
