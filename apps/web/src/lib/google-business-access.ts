import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'

export async function requireGbpListingAccess(listingId: string) {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const [profile, doc] = await Promise.all([getServerUserProfile(user.id), adminDb.collection('directory_listings').doc(listingId).get()])
  if (!doc.exists) return { error: 'Listing not found', status: 404 as const }
  const listing = doc.data() as any
  const access = resolveListingPatchAccess(listing, { userId: user.id, isStaff: hasEditorAccess(profile), managerAllowance: resolveEntitlements(listing).additionalManagers })
  if (!access.canManage) return { error: 'Forbidden', status: 403 as const }
  return { user, profile, listing, ref: doc.ref, isStaff: hasEditorAccess(profile) }
}
