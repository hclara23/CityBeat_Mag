import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// Honors an unsubscribe from a sales-outreach email. Marks the record so the
// agent's follow-up + new-contact logic both skip it.
export async function GET(request: NextRequest) {
  const o = new URL(request.url).searchParams.get('o')
  if (o) {
    try {
      await adminDb
        .collection('sales_outreach')
        .doc(o)
        .set({ status: 'unsubscribed', unsubscribed_at: FieldValue.serverTimestamp() }, { merge: true })
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
