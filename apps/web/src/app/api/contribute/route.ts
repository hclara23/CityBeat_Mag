import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter: 5 submissions per IP per hour
const submissionCounts = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = submissionCounts.get(ip)
  if (entry && entry.resetAt > now) {
    if (entry.count >= 5) return false
    entry.count++
    return true
  }
  submissionCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
  return true
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const bodyText = (formData.get('bodyText') as string | null)?.trim() ?? ''
  const excerpt = (formData.get('excerpt') as string | null)?.trim() ?? ''
  const category = (formData.get('category') as string | null)?.trim() ?? ''
  const tags = (formData.get('tags') as string | null)?.trim() ?? ''
  const agreeTerms = formData.get('agreeTerms') === 'true'
  const imageFile = formData.get('image') as File | null

  // Honeypot — bots fill this, humans don't
  const honeypot = (formData.get('website') as string | null) ?? ''
  if (honeypot) {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
  }

  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = 'Your name is required.'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'A valid email is required.'
  if (!title) fieldErrors.title = 'A title is required.'
  if (!bodyText || bodyText.length < 100) fieldErrors.bodyText = 'Please write at least 100 characters.'
  if (!agreeTerms) fieldErrors.agreeTerms = 'You must confirm the content is original.'

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Validation failed', fields: fieldErrors }, { status: 422 })
  }

  try {
    const docRef = await adminDb.collection('submissions').add({
      name,
      email,
      title,
      body_text: bodyText,
      excerpt: excerpt || bodyText.slice(0, 160),
      category: category || 'news',
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      image_filename: imageFile && imageFile.size > 0 ? imageFile.name : null,
      status: 'pending',
      source_ip: ip,
      created_at: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, id: docRef.id }, { status: 201 })
  } catch (error) {
    console.error('contribute submission error:', error)
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
  }
}
