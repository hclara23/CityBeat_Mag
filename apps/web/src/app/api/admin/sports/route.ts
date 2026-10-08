import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { automationAdmin } from '@/lib/admin-automation-auth'
import { ingestSportsUpdate, sportsSources } from '@/lib/sports'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const [sources, updates] = await Promise.all([sportsSources().limit(100).get(), adminDb.collection('sports_updates').orderBy('received_at', 'desc').limit(50).get()])
  return NextResponse.json({ sources: sources.docs.map(d => ({ id: d.id, ...d.data(), token_hash: undefined })), updates: updates.docs.map(d => ({ id: d.id, ...d.data() })) })
}

export async function POST(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json()
    if (body.action === 'source') {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100 ||
        !['owned', 'written_permission', 'licensed'].includes(body.permission_basis) ||
        typeof body.permission_evidence !== 'string' || body.permission_evidence.trim().length < 10 || body.permission_evidence.length > 2000 ||
        !Number.isFinite(Date.parse(body.permission_expires)) || Date.parse(body.permission_expires) <= Date.now() ||
        body.rights_confirmed !== true) return NextResponse.json({ error: 'Document valid permission to commercially publish this source’s supplied text before activation.' }, { status: 400 })
      const id = randomUUID()
      const token = randomBytes(32).toString('hex')
      await sportsSources().doc(id).create({ name: body.name.trim(), enabled: true, permission_basis: body.permission_basis,
        permission_evidence: body.permission_evidence.trim(), permission_expires: new Date(body.permission_expires).toISOString(),
        token_hash: createHash('sha256').update(token).digest('hex'), created_by: auth.user!.id, created_at: Date.now() })
      return NextResponse.json({ id, token }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }
    if (body.action === 'publish' && typeof body.source_id === 'string' && /^[a-f0-9-]{36}$/.test(body.source_id)) {
      if (body.rights_confirmed !== true) return NextResponse.json({ error: 'Confirm authorization to publish this text' }, { status: 400 })
      const result = await ingestSportsUpdate(body.source_id, { ...body, external_id: randomUUID(), published_at: new Date().toISOString() })
      return NextResponse.json(result, { status: 201 })
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch { return NextResponse.json({ error: 'Could not save. Check field lengths, permission expiry and daily allowance.' }, { status: 400 }) }
}

export async function PATCH(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const body = await request.json().catch(() => null)
  if (body?.action === 'disable' && /^[a-f0-9-]{36}$/.test(body.id)) {
    await sportsSources().doc(body.id).update({ enabled: false, disabled_at: Date.now(), disabled_by: auth.user!.id })
    return NextResponse.json({ ok: true })
  }
  if (body?.action === 'withdraw' && /^[a-f0-9]{64}$/.test(body.id)) {
    await adminDb.collection('sports_updates').doc(body.id).update({ status: 'withdrawn', withdrawn_at: Date.now(), withdrawn_by: auth.user!.id })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
