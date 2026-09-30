import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { isScannerHit } from '@/lib/lead-heat'

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
        const data = doc.data() as any
        const cur = data.status
        // Mail scanners follow every link seconds after delivery; that is not
        // a hot lead (lib/lead-heat.ts). The redirect still happens either way.
        const update = isScannerHit(data.last_sent_at)
          ? { scanner_clicks: FieldValue.increment(1), last_scanner_at: FieldValue.serverTimestamp() }
          : {
              clicks: FieldValue.increment(1),
              scanner_clicks: FieldValue.increment(0),
              status: cur === 'converted' ? cur : 'clicked',
              last_click_at: FieldValue.serverTimestamp(),
            }
        await ref.set(update, { merge: true })
      }
    } catch {
      /* never block the redirect */
    }
  }

  // Hand the landing page the outreach id so it can confirm a PERSON arrived:
  // components/OutreachVerify reports back only after a real interaction, which
  // scanners that merely follow the link never produce. Firestore auto-ids only.
  const dest = o && /^[A-Za-z0-9]{10,40}$/.test(o)
    ? `${safePath}${safePath.includes('?') ? '&' : '?'}cb_o=${encodeURIComponent(o)}`
    : safePath
  return NextResponse.redirect(`${APP_URL}${dest}`, 302)
}
