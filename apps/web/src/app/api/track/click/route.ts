import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// Records a click on a sales-outreach link, then redirects to a same-origin path.
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const o = params.get('o')
  const to = params.get('to') || '/'

  // Only allow same-origin relative paths to prevent open-redirect.
  const safePath = to.startsWith('/') && !to.startsWith('//') ? to : '/'

  if (o) {
    try {
      const ref = adminDb.collection('sales_outreach').doc(o)
      const doc = await ref.get()
      if (doc.exists) {
        const cur = (doc.data() as any).status
        await ref.set(
          { clicks: FieldValue.increment(1), status: cur === 'converted' ? cur : 'clicked', last_click_at: FieldValue.serverTimestamp() },
          { merge: true }
        )
      }
    } catch {
      /* never block the redirect */
    }
  }

  return NextResponse.redirect(`${APP_URL}${safePath}`, 302)
}
