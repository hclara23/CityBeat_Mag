// Client-side auth helpers backed by Firebase + the app's server session routes.
// Mirrors the previous auth API so pages can swap the import.
//
// Auth is server-session based (the `__session` cookie set by /api/auth/login),
// so reads go through /api/profile and writes through /api/auth/* routes.
import { auth } from './client'
import { sendPasswordResetEmail } from 'firebase/auth'

type AuthResult = {
  user?: any
  profile?: any
  error?: string
  message?: string
  data?: any
  success?: boolean
}

async function postJson(url: string, body?: any): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export async function signUp(
  email: string,
  password: string,
  meta: { fullName?: string; companyName?: string; phoneNumber?: string; isAdvertiser?: boolean } = {}
): Promise<AuthResult> {
  try {
    const { ok, data } = await postJson('/api/auth/signup', { email, password, ...meta })
    if (!ok) return { error: data.error || 'Sign up failed' }
    return { user: { id: data.uid, email }, message: 'Account created. You can now sign in.' }
  } catch (e: any) {
    return { error: e?.message || 'Sign up failed' }
  }
}

// Profile creation is handled server-side inside /api/auth/signup; this is a no-op
// kept for API compatibility with the previous auth module.
export async function createUserProfile(_userId?: string, _data?: any): Promise<AuthResult> {
  return { success: true }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { ok, data } = await postJson('/api/auth/login', { email, password })
    if (!ok) return { error: data.error || 'Sign in failed' }
    return { user: data.profile, data }
  } catch (e: any) {
    return { error: e?.message || 'Sign in failed' }
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    await postJson('/api/auth/logout')
  } catch {
    /* ignore */
  }
  try {
    const { signOut: fbSignOut } = await import('firebase/auth')
    await fbSignOut(auth)
  } catch {
    /* ignore */
  }
  return { success: true }
}

export async function resetPassword(email: string, _redirectTo?: string): Promise<AuthResult> {
  try {
    await sendPasswordResetEmail(auth, email)
    return { message: 'Password reset email sent. Check your inbox.' }
  } catch (e: any) {
    return { error: e?.message || 'Could not send reset email' }
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { ok, data } = await postJson('/api/auth/update-password', { password: newPassword })
    if (!ok) return { error: data.error || 'Could not update password' }
    return { success: true }
  } catch (e: any) {
    return { error: e?.message || 'Could not update password' }
  }
}

// Returns { user } | { user: null, error } to match the previous auth API.
//
// IMPORTANT: only a real 401/403 means "signed out". A network blip or a 5xx
// (e.g. a Cloud Run cold start) is transient — we retry a few times instead of
// reporting the user as logged out, otherwise navigating between pages bounces a
// perfectly valid session to /login. When all retries fail transiently we set
// `transient: true` so callers can choose NOT to sign the user out.
export async function getUser(): Promise<{ user: any | null; error?: string; transient?: boolean }> {
  const MAX_ATTEMPTS = 3
  let lastError = 'Auth check failed'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })

      if (res.ok) {
        const { profile } = await res.json()
        return { user: profile ? { id: profile.id, email: profile.email, ...profile } : null }
      }

      // Definitive auth failure — the session is genuinely gone. Don't retry.
      if (res.status === 401 || res.status === 403) {
        return { user: null, error: 'Unauthorized' }
      }

      // 5xx / 429 / anything else: transient, fall through and retry.
      lastError = `HTTP ${res.status}`
    } catch (e: any) {
      lastError = e?.message || 'Network error'
    }

    // Brief backoff before the next attempt (skip the wait after the last try).
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }

  // Couldn't reach the server cleanly. Report it as transient so guards keep the
  // user where they are rather than treating a network hiccup as a logout.
  return { user: null, error: lastError, transient: true }
}

// Returns { profile } | { error } to match the previous auth API.
export async function getUserProfile(_userId?: string): Promise<AuthResult> {
  try {
    const res = await fetch('/api/profile', { cache: 'no-store' })
    if (!res.ok) return { error: 'Unauthorized' }
    const { profile } = await res.json()
    return { profile }
  } catch (e: any) {
    return { error: e?.message || 'Could not load profile' }
  }
}

export async function getSession(): Promise<{ user: any } | null> {
  const { user } = await getUser()
  return user ? { user } : null
}

// Returns { profile, user } | { error } to match the previous auth API.
export async function updateProfile(updates: Record<string, any>): Promise<AuthResult> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(updates),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'Could not update profile' }
    return { profile: data.profile, user: data.profile }
  } catch (e: any) {
    return { error: e?.message || 'Could not update profile' }
  }
}
