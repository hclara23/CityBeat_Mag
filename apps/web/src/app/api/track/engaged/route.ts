import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

// "A person used the page this email sent them to." Posted by
// components/OutreachVerify after a genuine interaction on the landing page.
// This is what turns a lead from inferred (HOT / WARM, lib/lead-heat.ts) into
// VERIFIED: mail scanners follow the link, they do not tap, type or scroll.
//
// The outreach id is the bearer — it only ever appears inside the email that was
// sent to that business. Only an EXISTING sales_outreach doc is touched, so a
// guessed id cannot create anything.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`engaged:ip:${ip}`, { max: 30, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const o = typeof body?.o === 'string' ? body.o : ''
  if (!/^[A-Za-z0-9]{10,40}$/.test(o)) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const ref = adminDb.collection('sales_outreach').doc(o)
    const doc = await ref.get()
    if (!doc.exists) return NextResponse.json({ ok: false }, { status: 404 })
    const data = doc.data() as any
    await ref.set(
      {
        human_visits: FieldValue.increment(1),
        // First verification is the one that matters for the board; keep it.
        ...(data.verified_human_at ? {} : { verified_human_at: FieldValue.serverTimestamp() }),
        last_human_visit_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
