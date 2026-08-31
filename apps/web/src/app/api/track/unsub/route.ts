import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { suppress } from '@/lib/suppression'

export const dynamic = 'force-dynamic'

// Honors an unsubscribe from any marketing email. The token is the outreach
// doc id (unguessable) in its own collection: o= sales_outreach,
// u= upsell_outreach, r= recovery_outreach. x= is the unclaimed-relay stream,
// looked up by a RANDOM unsub_token field (relay doc ids embed event ids, so
// the doc id itself is not the token there). The doc is marked AND the email is
// added to the global suppression list so no other marketing stream emails it.
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const targets: Array<{ collection: string; id: string }> = []
  if (params.get('o')) targets.push({ collection: 'sales_outreach', id: params.get('o')! })
  if (params.get('u')) targets.push({ collection: 'upsell_outreach', id: params.get('u')! })
  if (params.get('r')) targets.push({ collection: 'recovery_outreach', id: params.get('r')! })

  for (const t of targets) {
    try {
      const ref = adminDb.collection(t.collection).doc(t.id)
      const doc = await ref.get()
      if (!doc.exists) continue
      await ref.set({ status: 'unsubscribed', unsubscribed_at: FieldValue.serverTimestamp() }, { merge: true })
      await suppress((doc.data() as any).email, `unsub:${t.collection}`)
    } catch {
      /* ignore */
    }
  }

  // Unclaimed-relay stream: token → doc lookup (token is random, never derived).
  const relayToken = params.get('x')
  if (relayToken && /^[a-f0-9]{24,64}$/i.test(relayToken)) {
    try {
      const snap = await adminDb
        .collection('unclaimed_relays')
        .where('unsub_token', '==', relayToken)
        .limit(1)
        .get()
      if (!snap.empty) {
        const doc = snap.docs[0]
        await doc.ref.set({ status: 'unsubscribed', unsubscribed_at: FieldValue.serverTimestamp() }, { merge: true })
        await suppress((doc.data() as any).email, 'unsub:unclaimed_relays')
      }
    } catch {
      /* ignore */
    }
  }

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
     <body style="font-family:system-ui;background:#0b0f17;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
     <div><h1 style="color:#22d3ee">You're unsubscribed</h1>
     <p style="color:#9aa">You won't receive further CityBeat outreach emails.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
