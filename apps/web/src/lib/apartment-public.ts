import { cache } from 'react'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { APARTMENT_COMMUNITIES } from './apartments'
import { approvedApartment } from './apartment-listing'

// One batched read per render; only approved, linked directory edits are public.
// The source catalog remains available during a database outage.
export const publicApartments = cache(async () => {
  try {
    const links = await adminDb.getAll(...APARTMENT_COMMUNITIES.map(p => adminDb.collection('apartment_listing_links').doc(p.slug)))
    const ids = links.map(link => link.data()?.listing_id).filter((id): id is string => typeof id === 'string' && !id.includes('/'))
    if (!ids.length) return [...APARTMENT_COMMUNITIES]
    const docs = await adminDb.getAll(...[...new Set(ids)].map(id => adminDb.collection('directory_listings').doc(id)))
    const byId = new Map(docs.map(doc => [doc.id, doc.data()]))
    return APARTMENT_COMMUNITIES.map((property, index) => approvedApartment(property, byId.get(links[index].data()?.listing_id)))
  } catch {
    return [...APARTMENT_COMMUNITIES]
  }
})
