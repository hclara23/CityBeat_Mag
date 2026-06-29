import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// One-click newsletter unsubscribe (linked from every digest). Marks every
// matching subscriber doc as unsubscribed and returns a simple confirmation page.
export async function GET(request: NextRequest) {
  const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase()
  if (!email) {
    return new NextResponse('Missing email.', { status: 400, headers: { 'Content-Type': 'text/html' } })
  }
  try {
    const snap = await adminDb.collection('newsletter_subscribers').where('email', '==', email).get()
    await Promise.all(
      snap.docs.map((d) => d.ref.set({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() }, { merge: true }))
    )
  } catch {
    /* fail soft — still show confirmation */
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed · CityBeat</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
  <div><h1 style="font-weight:800">You're unsubscribed</h1>
  <p style="color:#9ca3af">${email} will no longer receive the CityBeat newsletter.</p>
  <p><a href="https://citybeatmag.co" style="color:#06b6d4">Back to CityBeat →</a></p></div></body></html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}
