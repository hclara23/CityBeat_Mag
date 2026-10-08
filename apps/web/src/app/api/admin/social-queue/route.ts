import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { adminDb, adminStorage } from '@citybeat/lib/firebase/admin'
import { automationAdmin } from '@/lib/admin-automation-auth'
import { processImageQueueItem, queueCollection, queueEnabled } from '@/lib/social-queue'
import { MAX_IMAGE_BYTES, MONTHLY_LIMIT_CENTS, safeNotes } from '@/lib/social-queue-policy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const [items, budget] = await Promise.all([
    queueCollection().orderBy('created_at', 'desc').limit(100).get(),
    adminDb.collection('automation_budgets').doc(`social-images-${new Date().toISOString().slice(0, 7)}`).get(),
  ])
  return NextResponse.json({ enabled: queueEnabled(), monthly_limit_cents: MONTHLY_LIMIT_CENTS,
    reserved_cents: budget.data()?.reserved_cents || 0,
    items: items.docs.map(d => ({ id: d.id, ...d.data(), run_id: undefined })) })
}

export async function POST(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  if (Number(request.headers.get('content-length') || 0) > MAX_IMAGE_BYTES + 65536) {
    return NextResponse.json({ error: 'Image must be under 8 MB' }, { status: 413 })
  }
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG or WebP image under 8 MB' }, { status: 400 })
    }
    if (form.get('rights_confirmed') !== 'true') return NextResponse.json({ error: 'Publication rights confirmation required' }, { status: 400 })
    const notes = safeNotes(form.get('notes'))
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, animated: false })
      .rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
    const id = createHash('sha256').update(buffer).digest('hex')
    const ref = queueCollection().doc(id)
    const bucket = adminStorage.bucket(process.env.MEDIA_BUCKET || 'kerstenblueprint-media')
    const path = `social-queue/${id}.jpg`
    // Daily intake cap is global/transactional, not an instance-local counter.
    const intake = adminDb.collection('automation_budgets').doc(`social-intake-${new Date().toISOString().slice(0, 10)}`)
    const created = await adminDb.runTransaction(async tx => {
      const [existing, daily] = await Promise.all([tx.get(ref), tx.get(intake)])
      if (existing.exists) return 'duplicate'
      const count = daily.data()?.count || 0
      if (count >= 10) return 'limit'
      tx.set(intake, { count: count + 1 })
      tx.create(ref, { status: 'uploading', notes, created_at: Date.now(), updated_at: Date.now(),
        created_by: auth.user!.id, rights_confirmed: true, rights_confirmed_at: Date.now(),
        storage_path: path, image_url: `https://storage.googleapis.com/${bucket.name}/${path}` })
      return 'created'
    })
    if (created === 'duplicate') return NextResponse.json({ error: 'This image is already in the queue.', id }, { status: 409 })
    if (created === 'limit') return NextResponse.json({ error: 'Daily limit of 10 uploads reached.' }, { status: 429 })
    try {
      await bucket.file(path).save(buffer, { metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } })
      await ref.update({ status: 'queued', updated_at: Date.now() })
    } catch {
      await ref.update({ status: 'upload_failed', reason: 'Storage upload failed. Contact an administrator.', updated_at: Date.now() })
      return NextResponse.json({ error: 'Image storage failed', id }, { status: 503 })
    }
    // Await the worker; never fire-and-forget on a serverless instance. If this
    // connection dies, the durable queue remains visible to the scheduled worker.
    const status = await processImageQueueItem(id)
    return NextResponse.json({ id, status }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not accept this image. Refresh the queue before uploading again.' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const body = await request.json().catch(() => null)
  if (!body || !/^[a-f0-9]{64}$/.test(body.id) || !['cancel', 'retry'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const ref = queueCollection().doc(body.id)
  const changed = await adminDb.runTransaction(async tx => {
    const item = (await tx.get(ref)).data()
    if (!item) return false
    const allowed = body.action === 'cancel' ? ['queued', 'needs_review', 'reviewing'] : ['needs_review']
    if (!allowed.includes(item.status)) return false
    tx.update(ref, { status: body.action === 'cancel' ? 'cancelled' : 'queued',
      ...(body.action === 'retry' ? { notes: safeNotes(body.notes), caption: '', reviews: [] } : {}),
      reason: body.action === 'cancel' ? 'Cancelled by administrator' : 'Requested fresh independent review', updated_at: Date.now(), updated_by: auth.user!.id })
    return true
  })
  if (!changed) return NextResponse.json({ error: 'Item cannot be changed in its current state. Uncertain posts cannot be automatically retried.' }, { status: 409 })
  const status = body.action === 'retry' ? await processImageQueueItem(body.id) : 'cancelled'
  return NextResponse.json({ ok: true, status })
}
