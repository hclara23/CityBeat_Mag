import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { sportsSources, ingestSportsUpdate } from '@/lib/sports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Push-only syndication: no scraper, arbitrary server fetch or paid feed. Each
// authorized partner has an independently revocable scoped credential.
export async function POST(request: NextRequest) {
  const sourceId = request.headers.get('x-sports-source') || ''
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || ''
  if (!/^[a-f0-9-]{36}$/.test(sourceId) || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const source = (await sportsSources().doc(sourceId).get()).data()
  const expected = source?.token_hash
  const hash = createHash('sha256').update(token).digest('hex')
  if (typeof expected !== 'string' || expected.length !== 64 || !timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (Number(request.headers.get('content-length') || 0) > 16000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  try {
    const text = await request.text()
    if (Buffer.byteLength(text) > 16000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    const result = await ingestSportsUpdate(sourceId, JSON.parse(text))
    return NextResponse.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 201 })
  } catch {
    return NextResponse.json({ error: 'Update rejected. Verify the content fields, source permission expiry and daily allowance.' }, { status: 422 })
  }
}
