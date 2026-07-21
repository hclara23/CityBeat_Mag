import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminStorage } from '@citybeat/lib/firebase/admin'
import sharp from 'sharp'
import { authorizePaidSalesOrder, SalesOrderAccessError } from '@/lib/sales-order-server'
import { isAllowedIntakeImage } from '@/lib/sales-intake'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const MAX_UPLOADS_PER_WINDOW = 30
const attempts = new Map<string, { count: number; resetAt: number }>()

function uploadAllowed(orderId: string) {
  const now = Date.now()
  const attempt = attempts.get(orderId)
  if (attempt && attempt.resetAt > now) {
    if (attempt.count >= MAX_UPLOADS_PER_WINDOW) return false
    attempt.count += 1
    return true
  }
  attempts.set(orderId, { count: 1, resetAt: now + WINDOW_MS })
  return true
}

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const result = await authorizePaidSalesOrder({
      orderId: params.orderId,
      accessToken: request.nextUrl.searchParams.get('access') || '',
      sessionId: request.nextUrl.searchParams.get('session_id') || undefined,
    })
    if (result.order.intake_status === 'submitted') {
      return NextResponse.json({ error: 'This brief has already been submitted.' }, { status: 409 })
    }
    if (!uploadAllowed(params.orderId)) {
      return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 })
    }

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    const validationError = isAllowedIntakeImage({ type: file.type, size: file.size })
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const optimized = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer()
    const path = `sales-orders/${params.orderId}/${Date.now()}-${randomUUID()}.webp`
    const bucket = adminStorage.bucket(process.env.MEDIA_BUCKET || 'kerstenblueprint-media')
    const object = bucket.file(path)
    await object.save(optimized, {
      metadata: {
        contentType: 'image/webp',
        metadata: { salesOrderId: params.orderId, originalName: file.name.slice(0, 180) },
      },
    })
    const url = `https://storage.googleapis.com/${bucket.name}/${path}`
    const asset = {
      id: randomUUID(),
      url,
      storage_path: path,
      original_name: file.name.slice(0, 180),
      content_type: 'image/webp',
      uploaded_at: new Date().toISOString(),
    }
    await result.ref.set(
      { assets: FieldValue.arrayUnion(asset), updated_at: new Date().toISOString() },
      { merge: true }
    )
    return NextResponse.json({ asset })
  } catch (error) {
    if (error instanceof SalesOrderAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('sales order asset upload error:', error)
    return NextResponse.json({ error: 'Could not upload this image.' }, { status: 500 })
  }
}
