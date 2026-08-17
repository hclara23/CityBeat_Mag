import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import {
  notifyEditorialTeam,
  promotePublicSubmission,
  storePublicSubmissionImage,
} from '@/lib/public-submission-service'
import { validatePublicSubmissionImage } from '@/lib/public-submissions'

export const runtime = 'nodejs'
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
  const rawImage = formData.get('image')
  const imageFile = rawImage && typeof rawImage !== 'string' && rawImage.size > 0 ? rawImage : null

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
  const imageError = validatePublicSubmissionImage(imageFile)
  if (imageError) fieldErrors.image = imageError

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: 'Validation failed', fields: fieldErrors }, { status: 422 })
  }

  const docRef = adminDb.collection('submissions').doc()
  let saved = false

  try {
    // Save the contributor's original record before doing image processing or
    // notification work. If any later step fails, reconciliation can retry it
    // without asking the contributor to resubmit or overwriting their content.
    await docRef.create({
      name,
      email: email.toLowerCase(),
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
      image_filename: imageFile?.name || null,
      image_mime_type: imageFile?.type || null,
      image_url: null,
      image_path: null,
      status: 'pending',
      source_ip: ip,
      terms_accepted: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })
    saved = true

    let warning: string | null = null
    let warningCode: 'image_upload_failed' | null = null
    if (imageFile) {
      try {
        const image = await storePublicSubmissionImage(docRef.id, imageFile)
        await docRef.set(
          {
            image_url: image.url,
            image_path: image.path,
            image_uploaded_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warning = 'Your article was saved, but its image needs editorial attention.'
        warningCode = 'image_upload_failed'
        await docRef.set(
          {
            image_upload_error: message.slice(0, 300),
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      }
    }

    const promoted = await promotePublicSubmission(docRef.id)
    try {
      await notifyEditorialTeam(promoted.articleId, promoted.title)
      await docRef.set({ staff_notified_at: FieldValue.serverTimestamp() }, { merge: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await docRef.set(
        { notification_error: message.slice(0, 300), updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }

    return NextResponse.json(
      { ok: true, id: docRef.id, articleId: promoted.articleId, queued: true, warning, warningCode },
      { status: 201 },
    )
  } catch (error) {
    console.error('contribute submission error:', error)
    if (saved) {
      const message = error instanceof Error ? error.message : String(error)
      await docRef
        .set(
          {
            status: 'pending',
            queue_error: message.slice(0, 300),
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        .catch(() => {})
      return NextResponse.json(
        {
          ok: true,
          id: docRef.id,
          queued: false,
          warning: 'Your article is safely saved and will be placed in the review queue automatically.',
          warningCode: 'queue_pending',
        },
        { status: 202 },
      )
    }
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
  }
}
