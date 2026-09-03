import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { ERROR_COLLECTION } from '@/lib/error-reporting'
import { AI_AUDIT_COLLECTION, verifyAuditRecord } from '@/lib/ai-audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const iso = (v: any): string | null => {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

// Operator view over both observability surfaces:
//   • open bugs, grouped by fingerprint, worst first
//   • the AI audit trail, newest first, each row integrity-checked on read
//
// Staff-only + 2FA: error stacks and AI prompts can contain business data, so
// this is gated like every other admin route that exposes real content.
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasEditorAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!profile?.mfa_enabled) {
    return NextResponse.json({ error: 'Two-factor authentication required' }, { status: 403 })
  }

  try {
    const purpose = (request.nextUrl.searchParams.get('purpose') || '').slice(0, 80)

    let aiQuery: FirebaseFirestore.Query = adminDb.collection(AI_AUDIT_COLLECTION)
    if (purpose) aiQuery = aiQuery.where('purpose', '==', purpose)

    // allSettled + explicit flags: a bare catch(() => null) made "the index is
    // missing" look identical to "there is nothing to show".
    const [errRes, aiRes] = await Promise.allSettled([
      adminDb.collection(ERROR_COLLECTION).orderBy('last_seen_at', 'desc').limit(100).get(),
      aiQuery.orderBy('recorded_at', 'desc').limit(50).get(),
    ])
    const errSnap = errRes.status === 'fulfilled' ? errRes.value : null
    const aiSnap = aiRes.status === 'fulfilled' ? aiRes.value : null
    if (errRes.status === 'rejected') console.error('error_reports query failed:', errRes.reason)
    if (aiRes.status === 'rejected') console.error('ai_audit query failed:', aiRes.reason)

    const errors = (errSnap?.docs || []).map((d) => {
      const x = d.data() as any
      return {
        fingerprint: d.id,
        message: x.message,
        stack: (x.stack || '').slice(0, 1200),
        source: x.source,
        severity: x.severity,
        status: x.status || 'open',
        count: Number(x.count) || 0,
        routes: Array.isArray(x.routes) ? x.routes.slice(0, 6) : [],
        releases: Array.isArray(x.releases) ? x.releases.slice(0, 6) : [],
        first_seen_at: iso(x.first_seen_at),
        last_seen_at: iso(x.last_seen_at),
      }
    })

    const ai = (aiSnap?.docs || []).map((d) => {
      const x = d.data() as any
      return {
        id: d.id,
        purpose: x.purpose,
        model: x.model,
        input: (x.input || '').slice(0, 1500),
        output: (x.output || '').slice(0, 3000),
        input_tokens: x.input_tokens ?? null,
        output_tokens: x.output_tokens ?? null,
        latency_ms: x.latency_ms ?? null,
        subject: x.subject || null,
        ok: x.ok !== false,
        error: x.error || null,
        created_at: x.created_at || null,
        content_hash: x.content_hash || null,
        // Re-derive the hash on read: a row whose stored content no longer
        // matches its hash has been altered since it was written.
        integrity_ok: verifyAuditRecord(x),
      }
    })

    return NextResponse.json({
      errors,
      ai,
      errors_failed: errRes.status === 'rejected',
      ai_failed: aiRes.status === 'rejected',
      summary: {
        open_errors: errors.filter((e) => e.status !== 'resolved').length,
        critical_errors: errors.filter((e) => e.severity === 'critical' && e.status !== 'resolved').length,
        total_occurrences: errors.reduce((n, e) => n + e.count, 0),
        ai_records: ai.length,
        ai_integrity_failures: ai.filter((r) => !r.integrity_ok).length,
      },
    })
  } catch (error) {
    console.error('observability route failed:', error)
    return NextResponse.json({ error: 'Could not load observability data' }, { status: 500 })
  }
}

// Mark a bug resolved. It reopens itself (status 'regressed') if it recurs.
export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasEditorAccess(profile) || !profile?.mfa_enabled) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''
  const status = body.status === 'resolved' ? 'resolved' : 'open'
  if (!/^[0-9a-f]{16}$/.test(fingerprint)) {
    return NextResponse.json({ error: 'Invalid fingerprint' }, { status: 400 })
  }

  try {
    // update() (not set/merge): set would CREATE a ghost doc for any 16-hex
    // string, and a doc with no last_seen_at is silently excluded from the
    // ordered GET — an invisible row that can never be cleaned up from the UI.
    await adminDb.collection(ERROR_COLLECTION).doc(fingerprint).update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      resolved_by: user.id,
    })
    return NextResponse.json({ ok: true, status })
  } catch {
    return NextResponse.json({ error: 'Unknown fingerprint' }, { status: 404 })
  }
}
