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

/**
 * Full operator access: the customer lead inbox, paid-claim approval, the whole
 * directory, events, traffic analytics, and granting roles to other accounts.
 *
 * 'editor' is deliberately NOT in this list any more, and `is_editor` no longer
 * implies it. The two predicates used to be the same function, so the narrowest
 * grant that lets somebody publish the newsroom queue also read every contact
 * and quote request the public has ever submitted — names, emails, phone numbers
 * — approved paid claims (activating a tier somebody was charged for), let them
 * edit or publish any of 12,000 listings including rep-sold and paying ones, and
 * let them grant 'editor' to a further account. There was no grant that meant
 * only "can publish stories", which is the reason a second human could not be
 * onboarded safely, and a privacy exposure the published policy does not
 * contemplate.
 *
 * Nobody loses access to this change: the one production profile carrying
 * is_editor also carries role 'admin' explicitly, and the owner's profile is
 * developer with every role granted.
 */
export function hasAdminAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(hasDeveloperAccess(profile) || hasActiveRole(profile, ['admin']))
}

/**
 * Editorial access: the newsroom review queue and article publishing. Implied by
 * admin, so every existing operator keeps it, but grantable on its own.
 */
export function hasEditorAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(hasAdminAccess(profile) || profile?.is_editor || hasActiveRole(profile, ['editor']))
}

export function hasWriterAccess(profile: PlatformProfile | null | undefined) {
  return Boolean(
    // hasEditorAccess, not hasAdminAccess: an editor must still be able to use
    // the creator tools that feed the queue they review. Admin implies editor,
    // so this stays a superset for every existing operator.
    hasEditorAccess(profile) ||
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
  // Between admin and sales: an editor is now a real role rather than an alias
  // for admin, and without this branch a bare editor resolved to 'writer' (via
  // hasWriterAccess) or 'visitor', which is what the UI reads to label them.
  if (hasEditorAccess(profile)) return 'editor'
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
