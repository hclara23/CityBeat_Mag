import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { subscribeEmail } from '@/lib/newsletter-server'
import { normalizeNewsletterEmail } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(`newsletter-sub:ip:${getClientIp(req)}`, { max: 15, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

    const { email, locale, source } = await req.json()
    const normalized = normalizeNewsletterEmail(email)
    if (!normalized || !normalized.includes('@') || normalized.length > 200) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // subscribeEmail dedupes by normalized email, records the consent metadata,
    // and clears any suppression only because THIS is a deliberate resubscribe.
    const result = await subscribeEmail({
      email,
      locale,
      source: typeof source === 'string' ? source : 'newsletter',
      method: 'web_form',
    })
    if (!result.ok) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    return NextResponse.json({ success: true, status: result.status })
  } catch (err) {
    console.error('Newsletter API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
