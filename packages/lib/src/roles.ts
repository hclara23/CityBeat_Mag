export const PLATFORM_ROLES = [
  'developer',
  'admin',
  'editor',
  'writer',
  'contributor',
  'sales',
  'advertiser',
] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export type PlatformProfile = {
  id?: string
  role?: string | null
  is_developer?: boolean | null
  can_manage_platform?: boolean | null
  is_editor?: boolean | null
  is_writer?: boolean | null
  is_sales?: boolean | null
  is_advertiser?: boolean | null
  sales_dashboard_enabled?: boolean | null
  granted_roles?: string[] | null
  profile_roles?: Array<{ role?: string | null; revoked_at?: string | null }> | null
}

function hasActiveRole(profile: PlatformProfile | null | undefined, roles: PlatformRole[]) {
  if (!profile) return false
  if (profile.role && roles.includes(profile.role as PlatformRole)) return true
  if (profile.granted_roles?.some((role) => roles.includes(role as PlatformRole))) return true

  return Boolean(
    profile.profile_roles?.some((profileRole) => {
      if (profileRole.revoked_at) return false
      return roles.includes(profileRole.role as PlatformRole)
    })
  )
}

export function hasDeveloperAccess(profile: PlatformProfile | null | undefined) {
  // `can_manage_platform` is the godmode flag used across the app; treat it as
  // developer so the two never diverge.
  return Boolean(profile?.is_developer || profile?.can_manage_platform || hasActiveRole(profile, ['developer']))
}

export function hasAdminAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(
    hasDeveloperAccess(profile) ||
    profile?.is_editor ||
    hasActiveRole(profile, ['admin', 'editor'])
  )
}

export function hasEditorAccess(profile: PlatformProfile | null | undefined) {
  return hasAdminAccess(profile)
}

export function hasWriterAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(
    hasAdminAccess(profile) ||
    profile?.is_writer ||
    hasActiveRole(profile, ['writer'])
  )
}

export function hasSalesAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(
    hasAdminAccess(profile) ||
    profile?.is_sales ||
    profile?.sales_dashboard_enabled ||
    hasActiveRole(profile, ['sales'])
  )
}

// Advertiser/owner surfaces (campaigns, listing management). Developer/admin are
// a superset — godmode can do everything an advertiser can.
export function hasAdvertiserAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(
    hasAdminAccess(profile) ||
    profile?.is_advertiser ||
    hasActiveRole(profile, ['advertiser'])
  )
}

export function getPrimaryPlatformRole(profile: PlatformProfile | null | undefined): PlatformRole | 'visitor' {
  if (hasDeveloperAccess(profile)) return 'developer'
  if (hasAdminAccess(profile)) return 'admin'
  if (hasSalesAccess(profile)) return 'sales'
  if (hasWriterAccess(profile)) return 'writer'
  if (profile?.is_advertiser || hasActiveRole(profile, ['advertiser'])) return 'advertiser'
  if (hasActiveRole(profile, ['contributor'])) return 'contributor'
  return 'visitor'
}

// Resolve every cumulative capability once so login, profile reads, navigation,
// and API responses cannot disagree about a developer's effective access.
export function resolvePlatformCapabilities(profile: PlatformProfile | null | undefined) {
  const isDeveloper = hasDeveloperAccess(profile)
  const isEditor = hasEditorAccess(profile)
  const isWriter = hasWriterAccess(profile)
  const isSales = hasSalesAccess(profile)
  const isAdvertiser = hasAdvertiserAccess(profile)

  return {
    primary_role: getPrimaryPlatformRole(profile),
    is_developer: isDeveloper,
    can_manage_platform: isDeveloper,
    is_editor: isEditor,
    is_writer: isWriter,
    is_sales: isSales,
    sales_dashboard_enabled: isSales,
    is_advertiser: isAdvertiser,
  }
}

export function dashboardPathFor(profile: PlatformProfile | null | undefined) {
  const capabilities = resolvePlatformCapabilities(profile)
  if (capabilities.is_developer) return '/developer'
  if (capabilities.is_editor) return '/admin'
  if (capabilities.is_sales) return '/admin/sales/me'
  if (capabilities.is_writer) return '/creator'
  if (capabilities.is_advertiser) return '/dashboard'
  return '/account'
}

export function canManageRole(
  actor: PlatformProfile | null | undefined,
  targetRole: PlatformRole
) {
  if (hasDeveloperAccess(actor)) return true
  if (!hasAdminAccess(actor)) return false
  return targetRole !== 'developer' && targetRole !== 'admin'
}

export function normalizeRequestedRoles(input: unknown): PlatformRole[] {
  if (!Array.isArray(input)) return []

  const requested = new Set<PlatformRole>()
  for (const value of input) {
    if (typeof value !== 'string') continue
    if ((PLATFORM_ROLES as readonly string[]).includes(value)) {
      requested.add(value as PlatformRole)
    }
  }

  return Array.from(requested)
}
