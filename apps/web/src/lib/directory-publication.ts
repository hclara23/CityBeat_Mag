import { DIRECTORY_CATEGORIES } from './categories'
import { isGoogleMapsContent } from './scrapeflow/google-content'

export type PublicationBlockReason =
  | 'already_published'
  | 'merged_duplicate'
  | 'restricted_provenance'
  | 'invalid_name'
  | 'invalid_category'
  | 'no_contact_path'
  | 'closed_business'
  | 'duplicate_identity'

export type PublicationListing = {
  id: string
  is_published?: boolean
  merged_into?: string | null
  google_place_id?: string | null
  source_url?: string | null
  name?: string | null
  category?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
  business_status?: string | null
}

const CATEGORIES = new Set<string>(DIRECTORY_CATEGORIES)

function norm(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function identityKeys(listing: PublicationListing) {
  const name = norm(listing.name)
  if (!name) return []
  const keys: string[] = []
  const address = norm(listing.address)
  const phone = String(listing.phone || '').replace(/\D/g, '')
  const website = norm(listing.website)
  if (address) keys.push(`address:${name}|${address}`)
  if (phone.length >= 7) keys.push(`phone:${name}|${phone.slice(-10)}`)
  if (website) keys.push(`website:${name}|${website}`)
  return keys
}

function baseBlockReason(listing: PublicationListing): PublicationBlockReason | null {
  if (listing.is_published) return 'already_published'
  if (listing.merged_into) return 'merged_duplicate'
  if (isGoogleMapsContent(listing)) return 'restricted_provenance'
  if (norm(listing.name).length < 2) return 'invalid_name'
  if (!CATEGORIES.has(String(listing.category || ''))) return 'invalid_category'
  if (!norm(listing.address) && !norm(listing.phone) && !norm(listing.website)) return 'no_contact_path'
  if (/closed|inactive|revoked|expired/.test(norm(listing.business_status))) return 'closed_business'
  return null
}

export function auditDirectoryPublication(listings: PublicationListing[]) {
  const publishedKeys = new Set<string>()
  for (const listing of listings) {
    if (!listing.is_published || listing.merged_into) continue
    identityKeys(listing).forEach((key) => publishedKeys.add(key))
  }

  const candidateKeys = new Set<string>()
  const eligibleIds: string[] = []
  const blocked: Record<PublicationBlockReason, number> = {
    already_published: 0,
    merged_duplicate: 0,
    restricted_provenance: 0,
    invalid_name: 0,
    invalid_category: 0,
    no_contact_path: 0,
    closed_business: 0,
    duplicate_identity: 0,
  }

  for (const listing of listings) {
    const baseReason = baseBlockReason(listing)
    if (baseReason) {
      blocked[baseReason]++
      continue
    }
    const keys = identityKeys(listing)
    if (keys.some((key) => publishedKeys.has(key) || candidateKeys.has(key))) {
      blocked.duplicate_identity++
      continue
    }
    keys.forEach((key) => candidateKeys.add(key))
    eligibleIds.push(listing.id)
  }

  return {
    total: listings.length,
    unpublished: listings.filter((listing) => !listing.is_published).length,
    eligibleIds,
    eligible: eligibleIds.length,
    blocked,
  }
}
