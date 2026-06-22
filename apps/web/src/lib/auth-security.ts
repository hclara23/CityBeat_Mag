import { createHash } from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// ── Client IP ────────────────────────────────────────────────────────────────
// Cloud Run / Firebase Hosting set X-Forwarded-For (client is the first hop).
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

// ── Rate limiting (Firestore-backed, global across Cloud Run instances) ───────
// Fixed-window counter keyed by an arbitrary string. Fails OPEN on backend error
// so a Firestore hiccup can't lock everyone out.
export async function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const id = createHash('sha256').update(key).digest('hex').slice(0, 40)
  const ref = adminDb.collection('rate_limits').doc(id)
  const now = Date.now()
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.exists ? (snap.data() as any) : null
      if (!data || typeof data.reset_at !== 'number' || data.reset_at <= now) {
        tx.set(ref, { count: 1, reset_at: now + opts.windowMs })
        return { ok: true }
      }
      if (data.count >= opts.max) {
        return { ok: false, retryAfterSec: Math.ceil((data.reset_at - now) / 1000) }
      }
      tx.update(ref, { count: FieldValue.increment(1) })
      return { ok: true }
    })
  } catch {
    return { ok: true } // fail open
  }
}

// Clears a limiter (e.g. on a successful login so failures don't accumulate).
export async function clearRateLimit(key: string): Promise<void> {
  const id = createHash('sha256').update(key).digest('hex').slice(0, 40)
  try {
    await adminDb.collection('rate_limits').doc(id).delete()
  } catch {
    /* ignore */
  }
}

// ── Password policy ───────────────────────────────────────────────────────────
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyuiop', 'letmein', 'welcome', 'admin', 'iloveyou', 'abc12345',
  'passw0rd', 'football', 'baseball', 'dragon', 'monkey', 'sunshine', 'princess',
  'changeme', 'whatever', 'trustno1', 'citybeat', 'elpaso', 'elpaso123',
])

export function validatePassword(password: string): { ok: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 12) {
    return { ok: false, error: 'Password must be at least 12 characters.' }
  }
  if (password.length > 128) {
    return { ok: false, error: 'Password must be 128 characters or fewer.' }
  }
  if (!/[a-z]/.test(password)) return { ok: false, error: 'Password must include a lowercase letter.' }
  if (!/[A-Z]/.test(password)) return { ok: false, error: 'Password must include an uppercase letter.' }
  if (!/[0-9]/.test(password)) return { ok: false, error: 'Password must include a number.' }
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, error: 'Password must include a symbol.' }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'That password is too common. Choose something more unique.' }
  }
  return { ok: true }
}

// ── Breach check (HaveIBeenPwned k-anonymity range API) ───────────────────────
// Sends only the first 5 chars of the SHA-1 hash; the full password never leaves
// the server. Fails OPEN (network/HIBP error doesn't block signup).
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const text = await res.text()
    for (const line of text.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':')
      if (hashSuffix === suffix && Number(count) > 0) return true
    }
    return false
  } catch {
    return false // fail open
  }
}
