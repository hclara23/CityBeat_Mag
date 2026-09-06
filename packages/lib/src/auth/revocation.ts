// Session revocation.
//
// getServerUser verifies the session cookie with `checkRevoked: false`, on
// purpose: `true` calls Google on EVERY server render, which cost latency on
// every page and — worse — turned a transient network blip from Cloud Run into
// users being logged out mid-navigation. The documented price of that choice was
// that a session stayed valid until it expired, up to five days, with no way to
// end it. A stolen laptop, a compromised admin account, or a rep who was let go
// all meant waiting out the clock. There was no revocation path at all.
//
// This restores one without reintroducing the per-render network call. Firebase's
// own `revokeRefreshTokens` still runs (so no new session cookie can be minted),
// and alongside it we keep a single Firestore document of revocation times. The
// caller caches that document for a few seconds, so the common case costs
// nothing, and the comparison itself is the pure function below.

/** A session cookie's own claims, as returned by verifySessionCookie. */
export type SessionClaims = {
  uid?: unknown
  /** Seconds since epoch when the user actually authenticated. */
  auth_time?: unknown
  /** Seconds since epoch when this cookie was issued. */
  iat?: unknown
}

/** The revocation document: per-user times, plus a global "sign everyone out". */
export type RevocationRecord = {
  /** ISO timestamps keyed by uid. */
  users?: Record<string, unknown>
  /** ISO timestamp. Every session authenticated before this is dead. */
  all?: unknown
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Whether this session was signed in before its owner's sessions were revoked.
 *
 * Uses `auth_time` — when the person actually authenticated — rather than `iat`,
 * so refreshing a cookie cannot outrun a revocation. Falls back to `iat` only
 * when `auth_time` is absent.
 *
 * Fails OPEN on a malformed or missing revocation record and CLOSED on a session
 * whose own timestamps are unreadable. That asymmetry is deliberate: a corrupt
 * revocation document must not log out the entire user base, but a cookie we
 * cannot date must not be trusted against one.
 */
export function isSessionRevoked(
  claims: SessionClaims,
  record: RevocationRecord | null | undefined
): boolean {
  if (!record) return false

  const uid = typeof claims.uid === 'string' ? claims.uid : ''
  const globalCutoff = toMillis(record.all)
  const userCutoff = uid ? toMillis(record.users?.[uid]) : null

  // Nothing revoked that could apply to this session.
  const cutoff =
    globalCutoff === null ? userCutoff : userCutoff === null ? globalCutoff : Math.max(globalCutoff, userCutoff)
  if (cutoff === null) return false

  // Session cookie claims are in SECONDS; the cutoffs are in milliseconds.
  const authSeconds = toMillis(claims.auth_time) ?? toMillis(claims.iat)
  if (authSeconds === null) return true

  return authSeconds * 1000 < cutoff
}

/**
 * The patch that revokes one user's sessions, as of `now`.
 * Written with merge so revoking one person never disturbs anyone else's entry.
 */
export function revokeUserPatch(uid: string, now: Date = new Date()): RevocationRecord {
  return { users: { [uid]: now.toISOString() } }
}

/** The patch that ends every session in the system, as of `now`. */
export function revokeAllPatch(now: Date = new Date()): RevocationRecord {
  return { all: now.toISOString() }
}
