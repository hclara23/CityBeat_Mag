import { profileCompleteness, type ScoredListing } from './listing-scores'
import type { DirectoryEntitlements } from './directory-entitlements'

export function ownerListingProgress(listing: ScoredListing, entitlements: DirectoryEntitlements) {
  const items = profileCompleteness(listing).items.filter(item => {
    if (['description', 'description_es', 'image'].includes(item.key)) return entitlements.enhancedDescription
    if (item.key === 'social') return entitlements.socialLinks
    return true
  }).map(item => ({ ...item, section: item.key === 'hours' ? 'hours' : item.key === 'image' ? 'media' : 'profile' }))
  const completed = items.filter(item => item.done).length
  return { completed, total: items.length, score: Math.round(completed / items.length * 100), items }
}
