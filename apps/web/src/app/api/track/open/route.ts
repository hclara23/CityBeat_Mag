import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { isScannerHit } from '@/lib/lead-heat'

export const dynamic = 'force-dynamic'

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(request: NextRequest) {
  const o = new URL(request.url).searchParams.get('o')
  if (o) {
    try {
      const ref = adminDb.collection('sales_outreach').doc(o)
      const doc = await ref.get()
      if (doc.exists) {
        const data = doc.data() as any
        const cur = data.status
        // A mail scanner / Apple MPP preload on delivery is not a person
        // reading: count it separately so opens, status and the A/B stats
        // only ever reflect people (lib/lead-heat.ts).
        const update = isScannerHit(data.last_sent_at)
          ? { scanner_opens: FieldValue.increment(1), last_scanner_at: FieldValue.serverTimestamp() }
          : {
              opens: FieldValue.increment(1),
              scanner_opens: FieldValue.increment(0),
              status: cur === 'clicked' || cur === 'converted' ? cur : 'opened',
              last_open_at: FieldValue.serverTimestamp(),
            }
        await ref.set(update, { merge: true })
      }
    } catch {
      /* never block the pixel */
    }
  }
  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
