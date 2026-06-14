import { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'

export function requiresAuth(): boolean {
  if (process.env.ADS_REQUIRE_AUTH === 'true') return true
  if (process.env.NODE_ENV === 'production') return true
  return false
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      const demoUserId = process.env.ADS_DEMO_USER_ID
      if (demoUserId) {
        return demoUserId
      }
    }
    
    // In Firebase, session cookies could be used, but without a token we just return null for now.
    // If relying on Firebase Auth in the browser, the client should send the ID token in the header.
    return null
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    return null
  }
}

export async function isAdvertiser(userId: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection('profiles').doc(userId).get()
    
    if (!userDoc.exists) {
      return false
    }

    const data = userDoc.data()
    return Boolean(data?.is_advertiser)
  } catch (error) {
    console.error('Failed to check advertiser role:', error)
    return false
  }
}
