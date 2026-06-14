import { NextRequest, NextResponse } from 'next/server'
import { adminStorage } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import sharp from 'sharp'
import { canUploadCreatorMedia, validateCreatorUploadFile } from '@/lib/directory-security'

const CREATOR_UPLOAD_RATE_LIMIT = 20
const CREATOR_UPLOAD_WINDOW_MS = 60 * 60 * 1000
const uploadAttempts = new Map<string, { count: number; resetAt: number }>()

function checkCreatorUploadRateLimit(userId: string) {
  const now = Date.now()
  const current = uploadAttempts.get(userId)

  if (!current || current.resetAt <= now) {
    uploadAttempts.set(userId, { count: 1, resetAt: now + CREATOR_UPLOAD_WINDOW_MS })
    return true
  }

  if (current.count >= CREATOR_UPLOAD_RATE_LIMIT) {
    return false
  }

  current.count += 1
  return true
}

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id)
  if (!canUploadCreatorMedia(profile)) {
    return NextResponse.json({ error: 'Writer access is required' }, { status: 403 })
  }

  if (!checkCreatorUploadRateLimit(user.id)) {
    return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const validation = validateCreatorUploadFile({ type: file.type, size: file.size })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Optimize with sharp
    const optimizedBuffer = await sharp(inputBuffer)
      .resize(1600, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
    const filePath = `articles/${fileName}`

    const bucket = adminStorage.bucket()
    const fileRef = bucket.file(filePath)

    await fileRef.save(optimizedBuffer, {
      metadata: {
        contentType: 'image/webp',
      },
      public: true,
    })

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`

    return NextResponse.json({
      assetId: publicUrl,
      url: publicUrl,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
