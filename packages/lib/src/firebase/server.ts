import { cookies } from 'next/headers'
import { adminAuth, adminDb } from './admin'

export async function getServerUser(cookieStore?: any) {
  // In Firebase, we can check for a session cookie if set, 
  // or a custom token. For this migration, we'll try to read a generic auth cookie.
  const store = cookieStore || await cookies()
  
  // This is a placeholder since Firebase Auth with SSR requires specific setup 
  // (e.g. using Firebase Session Cookies). 
  // If using Next-Auth or similar, this would change.
  const sessionCookie = typeof store.get === 'function' ? store.get('session')?.value : null
  
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
