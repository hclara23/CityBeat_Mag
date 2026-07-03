import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { suppress } from '@/lib/suppression'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Resend delivery-event webhook: hard bounces and spam complaints go straight
// onto the global suppression list, protecting sender reputation. Signed with
// the svix scheme; RESEND_WEBHOOK_SECRET (whsec_...) required — fails closed.
//
// Setup (one-time, Resend dashboard): Webhooks → Add endpoint →
// https://citybeatmag.co/api/webhooks/resend → events email.bounced +
// email.complained → copy the signing secret into RESEND_WEBHOOK_SECRET.

function verifySvix(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signatures = headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false
  // Reject stale timestamps (replay protection, 5 min).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // Header may contain multiple space-separated "v1,<sig>" entries.
  for (const part of signatures.split(' ')) {
    const sig = part.split(',')[1]
    if (!sig) continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  const body = await req.text()
  if (!verifySvix(body, req.headers, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event?.type === 'email.bounced' || event?.type === 'email.complained') {
    const recipients: string[] = Array.isArray(event?.data?.to) ? event.data.to : [event?.data?.to].filter(Boolean)
    for (const to of recipients) {
      await suppress(String(to), event.type === 'email.bounced' ? 'bounce' : 'complaint')
    }
  }

  return NextResponse.json({ received: true })
}
