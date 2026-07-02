import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(`newsletter-sub:ip:${getClientIp(req)}`, { max: 15, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

    const { email, locale } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // Check if user is already subscribed
    const existing = await adminDb.collection('newsletter_subscribers').where('email', '==', email).get()
    if (!existing.empty) {
      return NextResponse.json({ message: 'Already subscribed' }, { status: 200 })
    }

    // Add to Firestore
    await adminDb.collection('newsletter_subscribers').add({
      email,
      locale: locale || 'en',
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Newsletter API error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
