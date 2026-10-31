import { cache } from 'react'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { APARTMENT_COMMUNITIES, type ApartmentCommunity } from './apartments'
import { approvedApartment } from './apartment-listing'
import { publicPropertyCompanies } from './property-company-public'
import { unstable_cache } from 'next/cache'
import { publicRentalFromListing } from './property-rental-public'

const submittedRentals = unstable_cache(async (): Promise<ApartmentCommunity[]> => {
  const docs = await adminDb.collection('directory_listings').where('property_custom', '==', true).limit(1000).get()
  const companies = await publicPropertyCompanies()
  return docs.docs.flatMap(doc => {
    const data = doc.data(), company = companies.find(c => c.id === data.property_account_id)
    const property = publicRentalFromListing(doc.id, data, company)
    return property ? [property] : []
  })
}, ['approved-property-portfolio-rentals-v1'], { revalidate: 60 })

// One batched read per render; only approved, linked directory edits are public.
// The source catalog remains available during a database outage.
export const publicApartments = cache(async () => {
  try {
    const links = await adminDb.getAll(...APARTMENT_COMMUNITIES.map(p => adminDb.collection('apartment_listing_links').doc(p.slug)))
    const ids = links.map(link => link.data()?.listing_id).filter((id): id is string => typeof id === 'string' && !id.includes('/'))
    const docs = ids.length ? await adminDb.getAll(...[...new Set(ids)].map(id => adminDb.collection('directory_listings').doc(id))) : []
    const byId = new Map(docs.map(doc => [doc.id, doc.data()]))
    return [...APARTMENT_COMMUNITIES.map((property, index) => approvedApartment(property, byId.get(links[index].data()?.listing_id))), ...await submittedRentals()]
  } catch {
    return [...APARTMENT_COMMUNITIES]
  }
})
