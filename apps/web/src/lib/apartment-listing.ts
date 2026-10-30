import type { Firestore } from 'firebase-admin/firestore'
import { getApartment, type ApartmentCommunity } from './apartments'

export class ApartmentLinkError extends Error {}
const clean = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const host = (value: unknown) => {
  try { return new URL(String(value)).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}

export function sameApartment(property: ApartmentCommunity, data: Record<string, unknown>) {
  const name = clean(data.name) === clean(property.name)
  const street = clean(data.address).startsWith(clean(property.address))
  const website = host(data.website) === host(property.website)
  const phone = String(data.phone || '').replace(/\D/g, '').slice(-10) === property.phone
  return (name && (street || website || phone)) || (street && website)
}

export function apartmentSeed(property: ApartmentCommunity) {
  return {
    name: property.name, address: property.address, city: 'El Paso', state: 'TX', zip: property.zip,
    phone: `+1${property.phone}`, website: property.website, category: 'Real Estate',
    description: property.summary.en, description_es: property.summary.es,
    apartment_slug: property.slug, tier: 'basic', owner_id: null, claim_status: 'unclaimed',
    ownership_verified: false, is_published: true, is_sponsored: false, rating: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}

/** Only an authenticated, consented claim may create the backing directory record.
 * The mapping is server-managed and never trusts a client-provided listing ID.
 */
export async function resolveApartmentListing(db: Firestore, slug: string, create = false) {
  const property = getApartment(slug)
  if (!property) return null
  return db.runTransaction(async tx => {
    const mappingRef = db.collection('apartment_listing_links').doc(slug)
    const mapping = await tx.get(mappingRef)
    if (mapping.exists) {
      const id = mapping.data()?.listing_id
      if (typeof id !== 'string' || id.includes('/')) throw new ApartmentLinkError('Invalid mapping')
      const doc = await tx.get(db.collection('directory_listings').doc(id))
      if (!doc.exists) throw new ApartmentLinkError('Missing linked listing')
      return { id: doc.id, data: doc.data()! }
    }
    const listings = db.collection('directory_listings')
    const deterministicRef = listings.doc(`apartment-${slug}`)
    const existing = await tx.get(deterministicRef)
    // Candidate searches are bounded. Any ambiguous identity requires staff review.
    const queries = [
      listings.where('name', '==', property.name).limit(20),
      listings.where('website', 'in', [property.website, property.website.replace(/\/$/, ''), property.website.replace('www.', '')]).limit(20),
      listings.where('phone', 'in', [property.phone, `+1${property.phone}`, `(${property.phone.slice(0,3)}) ${property.phone.slice(3,6)}-${property.phone.slice(6)}`]).limit(20),
    ]
    const snapshots = await Promise.all(queries.map(query => tx.get(query)))
    if (snapshots.some(s => s.size >= 20)) throw new ApartmentLinkError('Ambiguous listing')
    const candidates = new Map<string, Record<string, unknown>>()
    if (existing.exists) candidates.set(existing.id, existing.data()!)
    for (const snap of snapshots) for (const doc of snap.docs) candidates.set(doc.id, doc.data())
    // Do not silently create a duplicate or link a different location on weak evidence.
    if (candidates.size > 1 || [...candidates.values()].some(data => !sameApartment(property, data))) {
      throw new ApartmentLinkError('Listing identity requires review')
    }
    const match = [...candidates.entries()][0]
    if (!match && !create) return { id: deterministicRef.id, data: apartmentSeed(property) }
    const id = match?.[0] || deterministicRef.id
    const data = match?.[1] || apartmentSeed(property)
    if (create) {
      if (!match) tx.create(deterministicRef, data)
      tx.create(mappingRef, { listing_id: id, created_at: new Date().toISOString() })
    }
    return { id, data }
  })
}

/** Public pages use approved basic edits; pending claims cannot alter the catalog. */
export function approvedApartment(property: ApartmentCommunity, data?: Record<string, unknown>): ApartmentCommunity {
  if (!data || data.claim_status !== 'approved' || !data.owner_id || data.is_published === false) return property
  const text = (field: string, fallback: string) => typeof data[field] === 'string' && data[field] ? String(data[field]) : fallback
  // Apartment cards format US leasing lines. Never turn a non-US/invalid update
  // into a different destination by blindly adding +1.
  const updatedPhone = String(data.phone || '').replace(/\D/g, '').match(/^(?:1)?([2-9]\d{2}[2-9]\d{6})$/)?.[1]
  return { ...property, name: text('name', property.name), address: text('address', property.address),
    phone: updatedPhone || property.phone,
    website: /^https?:\/\//.test(String(data.website)) ? String(data.website) : property.website,
    summary: { en: text('description', property.summary.en), es: text('description_es', property.summary.es) } }
}
