import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from './privileged-access'

export async function requireGbpAdminAccess() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  return denial || { user }
}
