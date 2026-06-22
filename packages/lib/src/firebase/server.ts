import { cookies } from 'next/headers'
import { adminAuth, adminDb } from './admin'

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
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true)
    return {
      id: decodedClaims.uid,
      email: decodedClaims.email,
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
