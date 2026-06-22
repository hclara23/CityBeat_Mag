import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// First-party page-view logging. Lightweight, unauthenticated, fails silently —
// powers the admin dashboard's real traffic numbers (independent of GA4).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    let path = typeof body.path === 'string' ? body.path : ''
    if (!path) return NextResponse.json({ ok: true })
    path = path.split('?')[0].split('#')[0].slice(0, 300)

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
