import { cookies } from 'next/headers'
import { adminAuth, adminDb } from './admin'
import { isSessionRevoked, type RevocationRecord } from '../auth/revocation'

// One document holds every revocation. Read at most once every REVOCATION_TTL_MS
// per instance, so the common case — nobody has revoked anything — costs no
// network call at all. That is the whole point: verifySessionCookie's own
// checkRevoked flag would call Google on EVERY server render, which is why it is
// off (see below), and reintroducing that cost was not an acceptable price for
// being able to shut a door.
//
// The TTL is the worst-case window a revoked session survives. Seconds, versus
// the five days it used to get.
const REVOCATION_TTL_MS = 15_000
let revocationCache: { at: number; record: RevocationRecord | null } = { at: 0, record: null }

async function getRevocations(): Promise<RevocationRecord | null> {
  const now = Date.now()
  if (now - revocationCache.at < REVOCATION_TTL_MS) return revocationCache.record
  try {
    const doc = await adminDb.collection('security').doc('revocations').get()
    revocationCache = { at: now, record: doc.exists ? (doc.data() as RevocationRecord) : null }
  } catch {
    // Firestore unreachable: keep serving the last known record rather than
    // logging everyone out. Only refresh the clock on a successful read, so a
    // blip does not pin a stale record for longer than the outage.
    return revocationCache.record
  }
  return revocationCache.record
}

/** Drops the cached revocations so a just-issued revocation applies immediately
 *  on the instance that issued it. Other instances catch up within the TTL. */
export function invalidateRevocationCache(): void {
  revocationCache = { at: 0, record: null }
}

// Name of the session cookie set by /api/auth/login.
// MUST be `__session` — Firebase Hosting (Fastly CDN) in front of Cloud Run strips
// every cookie except `__session` before forwarding to the backend.
export const FIREBASE_SESSION_COOKIE = '__session'

// Read the session cookie value from any supported cookie-store shape:
// a Next.js cookies() store (.get), a readonly { getAll } store, or undefined.
function readSessionCookie(store: any): string | null {
  if (store && typeof store.get === 'function') {
    return store.get(FIREBASE_SESSION_COOKIE)?.value ?? null
  }
  if (store && typeof store.getAll === 'function') {
    return store.getAll().find((c: any) => c.name === FIREBASE_SESSION_COOKIE)?.value ?? null
  }
  return null
}

export async function getServerUser(cookieStore?: any) {
  const store = cookieStore || (await cookies())
  const sessionCookie = readSessionCookie(store)

  if (!sessionCookie) return null

  try {
    // checkRevoked=false: verify the cookie's signature + expiry locally instead
    // of hitting Google on every render. With checkRevoked=true a transient
    // network blip from Cloud Run threw here and logged users out mid-navigation.
    // Trade-off: a revoked session stays valid until it expires (5 days).
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false)

    // …which is why revocation is enforced here instead. Without this there was
    // no way to end a session at all: a stolen laptop or a compromised admin
    // meant waiting out the cookie's five-day expiry.
    if (isSessionRevoked(decodedClaims as any, await getRevocations())) return null

    return {
      id: decodedClaims.uid,
      email: decodedClaims.email,
      email_verified: decodedClaims.email_verified === true,
    }
  } catch (error) {
    return null
  }
}

export async function getServerUserProfile(userId: string, cookieStore?: any): Promise<any> {
  try {
    const doc = await adminDb.collection('profiles').doc(userId).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as any
  } catch (error) {
    return null
  }
}
