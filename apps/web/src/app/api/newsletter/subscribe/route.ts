import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export async function POST(req: Request) {
  try {
    const { email, locale } = await req.json()

    if (!email || !email.includes('@')) {
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
