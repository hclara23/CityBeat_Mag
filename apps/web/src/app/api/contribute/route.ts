import { NextRequest, NextResponse } from 'next/server'
import { getSanityWriteClient } from '@/lib/sanity'

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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 96)
}

function toPortableText(text: string) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((paragraph, i) => ({
      _type: 'block',
      _key: `block-${i}`,
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span', _key: `span-${i}`, marks: [], text: paragraph.trim() }],
    }))
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 submissions per IP per hour
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

  // Validate required fields
  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = 'Your name is required.'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'A valid email is required.'
  if (!title) fieldErrors.title = 'A title is required.'
  if (!bodyText || bodyText.length < 100) fieldErrors.bodyText = 'Please write at least 100 characters.'
  if (!agreeTerms) fieldErrors.agreeTerms = 'You must confirm the content is original.'

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Validation failed', fields: fieldErrors }, { status: 422 })
  }

  const client = getSanityWriteClient()
  let imageRef: { _type: string; asset: { _type: string; _ref: string } } | undefined

  // Upload image if provided
  if (imageFile && imageFile.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 })
    }
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large. Maximum size is 10 MB.' }, { status: 400 })
    }

    try {
      const buffer = Buffer.from(await imageFile.arrayBuffer())
      const asset = await client.assets.upload('image', buffer, {
        filename: imageFile.name,
        contentType: imageFile.type,
      })
      imageRef = { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
    } catch {
      return NextResponse.json({ error: 'Image upload failed. Please try again.' }, { status: 500 })
    }
  }

  const now = new Date().toISOString()
  const doc: { _type: string; [key: string]: unknown } = {
    _type: 'article',
    title,
    slug: { _type: 'slug', current: slugify(title) },
    author: name,
    authorEmail: email,
    isContribution: true,
    submittedAt: now,
    publishedAt: now,
    excerpt,
    body: toPortableText(bodyText),
    category: category || undefined,
    tags: tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    status: 'pending_review',
  }

  if (imageRef) doc.image = imageRef

  try {
    const created = await client.create(doc)
    return NextResponse.json({ success: true, id: created._id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
  }
}
