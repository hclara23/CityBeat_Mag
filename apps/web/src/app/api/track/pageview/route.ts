import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

// Comma-separated IP denylist (set ANALYTICS_EXCLUDED_IPS in env). Views from
// these IPs are never counted — handy for office/home IPs you don't want in the
// numbers even when signed out.
function excludedIps(): string[] {
  return (process.env.ANALYTICS_EXCLUDED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Internal team members shouldn't inflate audience analytics. Returns true if the
// session cookie belongs to a staff account (developer / editor / writer / sales).
async function isStaffRequest(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get('__session')?.value
  if (!sessionCookie) return false
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, false)
    const snap = await adminDb.collection('profiles').doc(decoded.uid).get()
    const p = (snap.data() || {}) as Record<string, unknown>
    return Boolean(p.is_developer || p.is_editor || p.is_writer || p.is_sales)
  } catch {
    // Invalid/expired session — treat as an ordinary anonymous visitor.
    return false
  }
}

// First-party page-view logging. Lightweight, unauthenticated, fails silently —
// powers the admin dashboard's real traffic numbers (independent of GA4).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let path = typeof body.path === 'string' ? body.path : ''
    if (!path) return NextResponse.json({ ok: true })
    path = path.split('?')[0].split('#')[0].slice(0, 300)

    // Don't count internal staff or denylisted IPs.
    const ip = getClientIp(request)
    if (ip && excludedIps().includes(ip)) {
      return NextResponse.json({ ok: true, skipped: 'ip' })
    }
    if (await isStaffRequest(request)) {
      return NextResponse.json({ ok: true, skipped: 'staff' })
    }

    // Flood guard: this is an unauthenticated Firestore write per call. 300/hr is
    // far beyond any human browsing rate but caps write-cost abuse and keeps
    // bot floods from polluting the traffic numbers. Fails open like the rest.
    const rl = await checkRateLimit(`pageview:ip:${ip}`, { max: 300, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: true, skipped: 'rate' })

    const now = new Date()
    await adminDb.collection('analytics_events').add({
      path,
      ts: now.toISOString(),
      day: now.toISOString().slice(0, 10),
      created_at: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
