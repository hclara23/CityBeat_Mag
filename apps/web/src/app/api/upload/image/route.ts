import { NextRequest, NextResponse } from 'next/server'
import { adminStorage } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const WINDOW_MS = 60 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function allow(uid: string): boolean {
  const now = Date.now()
  const e = attempts.get(uid)
  if (e && e.resetAt > now) {
    if (e.count >= 40) return false
    e.count++
    return true
  }
  attempts.set(uid, { count: 1, resetAt: now + WINDOW_MS })
  return true
}

// General image upload for any signed-in user (business owners uploading listing
// photos, reviewers uploading review photos). Returns a public URL. Attaching the
// URL to a listing is still gated by the owner-only PATCH /api/directory/[id].
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allow(user.id)) {
    return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large. Maximum size is 10 MB.' }, { status: 400 })
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer())
    const optimized = await sharp(inputBuffer)
      .resize(1600, null, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    const path = `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
    const bucket = adminStorage.bucket(process.env.MEDIA_BUCKET || 'kerstenblueprint-media')
    const ref = bucket.file(path)
    // Bucket uses uniform access + bucket-level public read, so no per-object ACL.
    await ref.save(optimized, { metadata: { contentType: 'image/webp' } })

    const url = `https://storage.googleapis.com/${bucket.name}/${path}`
    return NextResponse.json({ url, assetId: url })
  } catch (error) {
    console.error('image upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
