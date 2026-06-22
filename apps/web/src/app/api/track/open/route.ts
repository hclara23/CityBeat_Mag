import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

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
        const cur = (doc.data() as any).status
        await ref.set(
          { opens: FieldValue.increment(1), status: cur === 'clicked' || cur === 'converted' ? cur : 'opened', last_open_at: FieldValue.serverTimestamp() },
          { merge: true }
        )
      }
    } catch {
      /* never block the pixel */
    }
  }
  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
