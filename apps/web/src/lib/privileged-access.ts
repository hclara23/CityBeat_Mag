import type { PlatformProfile } from '@citybeat/lib/roles'

// The 2FA gate for privileged APIs.
//
// Every privileged PAGE bounces an operator who has not enrolled in TOTP to
// /account/security ([locale]/developer/layout.tsx, [locale]/admin/(protected)/
// layout.tsx, [locale]/admin/(sales)/layout.tsx). That redirect is the entire
// "mandatory 2FA" control, and it is a redirect, not an account lock: a staff
// account can sit at mfa_enabled:false indefinitely and /api/auth/login still
// issues a session on the password alone (it only branches to the TOTP step when
// mfa_enabled is true).
//
// Fourteen of the thirty-two routes under api/admin, api/developer and
// api/platform checked the ROLE and nothing else. A phished staff password
// therefore opened no admin page and every API behind them — including the
// full-customer PII export (GET /api/developer/audience?dataset=profiles&
// format=csv) and role granting (PATCH /api/platform/roles, which can hand a
// second account permanent godmode). The same hole let a legitimately-enrolled
// admin who called /api/auth/2fa/disable keep full API access.
//
// The decision lives here, once, so a new privileged route cannot implement half
// of it. Routes still do their own 401 for "not signed in"; this covers the
// role + second-factor pair that must never come apart.

/** Shown to an operator whose role is fine but whose second factor is not. */
export const TWO_FACTOR_REQUIRED =
  'Two-factor authentication is required for this action. Enable it under Account → Security.'

export type PrivilegedActorProfile =
  | (PlatformProfile & { mfa_enabled?: boolean | null })
  | null
  | undefined

export type PrivilegedDenial = { error: string; status: 403 }

/**
 * Why this signed-in actor may not use a privileged API, or null if they may.
 *
 * `hasRole` is the caller's own role predicate (hasAdminAccess / hasDeveloperAccess
 * / hasSalesAccess) so this stays a pure decision over already-loaded state.
 *
 * The role check runs FIRST and returns a plain 'Forbidden': someone without the
 * role must not learn from the error message that the only thing between them and
 * the endpoint is a second factor.
 */
export function privilegedDenial(
  profile: PrivilegedActorProfile,
  hasRole: boolean
): PrivilegedDenial | null {
  if (!hasRole) return { error: 'Forbidden', status: 403 }
  // Truthiness, not `=== true`, matching the eleven routes that already had this
  // check — a profile whose flag was written by some older path must fail the
  // same way here as it does there rather than locking a real admin out.
  if (!profile?.mfa_enabled) return { error: TWO_FACTOR_REQUIRED, status: 403 }
  return null
}
