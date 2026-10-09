import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { adminDb, adminStorage } from '@citybeat/lib/firebase/admin'
import { automationAdmin } from '@/lib/admin-automation-auth'
import { queueCollection, queueControl, queueEnabled, reserveSlot } from '@/lib/social-queue'
import { ITEM_RESERVATION_CENTS, MAX_IMAGE_BYTES, MONTHLY_LIMIT_CENTS, safeNotes } from '@/lib/social-queue-policy'
import { isSlot, QUEUE_HOURS, QUEUE_TIMEZONE, safeArticleLink } from '@/lib/social-schedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const [items, active, budget, control] = await Promise.all([
    queueCollection().orderBy('created_at', 'desc').limit(100).get(),
    queueCollection().where('status', 'in', ['uploading', 'queued', 'reviewing', 'scheduled', 'publishing', 'paused', 'needs_review', 'publish_uncertain']).limit(400).get(),
    adminDb.collection('automation_budgets').doc(`social-images-${new Date().toISOString().slice(0, 7)}`).get(),
    queueControl().get(),
  ])
  return NextResponse.json({ enabled: queueEnabled(), monthly_limit_cents: MONTHLY_LIMIT_CENTS,
    paused: Boolean(control.data()?.paused), timezone: QUEUE_TIMEZONE, hours: QUEUE_HOURS,
    reservation_cents: ITEM_RESERVATION_CENTS, reserved_cents: budget.data()?.reserved_cents || 0,
    items: [...new Map([...items.docs, ...active.docs].map(d => [d.id, d])).values()].map(d => ({ id: d.id, ...d.data(), run_id: undefined })) })
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
    const article_url = safeArticleLink(form.get('article_url'))
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, animated: false })
      .rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
    const id = createHash('sha256').update(buffer).digest('hex')
    const ref = queueCollection().doc(id)
    const bucket = adminStorage.bucket(process.env.MEDIA_BUCKET || 'kerstenblueprint-media')
    const path = `social-queue/${id}.jpg`
    const uploadId = randomUUID()
    // Daily intake cap is global/transactional, not an instance-local counter.
    const intake = adminDb.collection('automation_budgets').doc(`social-intake-${new Date().toISOString().slice(0, 10)}`)
    const created = await adminDb.runTransaction(async tx => {
      const [existing, daily, settings] = await Promise.all([tx.get(ref), tx.get(intake), tx.get(queueControl())])
      const old = existing.data()
      const recoverable = old?.status === 'upload_failed' || (old?.status === 'uploading' && old.updated_at < Date.now() - 10 * 60_000)
      if (existing.exists && !recoverable) return 'duplicate'
      const count = daily.data()?.count || 0
      if (count >= 100) return 'limit'
      const reservation = reserveSlot(settings.data(), id, Date.now())
      tx.set(queueControl(), { ...settings.data(), slots: reservation.slots })
      tx.set(intake, { count: count + 1 })
      tx.set(ref, { status: 'uploading', upload_id: uploadId, notes, article_url, scheduled_at: reservation.scheduled_at,
        original_name: file.name.slice(0, 150), created_at: Date.now(), updated_at: Date.now(),
        created_by: auth.user!.id, rights_confirmed: true, rights_confirmed_at: Date.now(),
        storage_path: path, image_url: `https://storage.googleapis.com/${bucket.name}/${path}` })
      return 'created'
    })
    if (created === 'duplicate') return NextResponse.json({ error: 'This image is already in the queue.', id }, { status: 409 })
    if (created === 'limit') return NextResponse.json({ error: 'Daily limit of 100 uploads reached.' }, { status: 429 })
    const finishUpload = (fields: Record<string, unknown>) => adminDb.runTransaction(async tx => {
      const current = (await tx.get(ref)).data()
      if (current?.status !== 'uploading' || current?.upload_id !== uploadId) return false
      tx.update(ref, { ...fields, updated_at: Date.now() })
      return true
    })
    try {
      await bucket.file(path).save(buffer, { metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } })
      if (!await finishUpload({ status: 'queued' })) return NextResponse.json({ id, status: 'superseded' })
    } catch {
      await finishUpload({ status: 'upload_failed', reason: 'Storage upload failed. You can upload this same image again.' })
      return NextResponse.json({ error: 'Image storage failed', id }, { status: 503 })
    }
    // Durable intake only. The scheduler prepares captions independently of this
    // browser connection, and publication has its own due-time gate.
    return NextResponse.json({ id, status: 'queued' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not accept this image. Refresh the queue before uploading again.' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await automationAdmin(request)
  if (auth.error) return auth.error
  const body = await request.json().catch(() => null)
  if (body?.action === 'pause_all' || body?.action === 'resume_all') {
    await queueControl().set({ paused: body.action === 'pause_all', updated_at: Date.now(), updated_by: auth.user!.id }, { merge: true })
    return NextResponse.json({ ok: true, status: body.action === 'pause_all' ? 'paused' : 'active' })
  }
  if (!body || !/^[a-f0-9]{64}$/.test(body.id) || !['cancel', 'retry', 'pause', 'resume', 'edit', 'reschedule'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  let article_url: string | undefined
  try { if (body.article_url !== undefined) article_url = safeArticleLink(body.article_url) } catch {
    return NextResponse.json({ error: 'Use a valid CityBeat article URL.' }, { status: 400 })
  }
  if (body.caption !== undefined && (typeof body.caption !== 'string' || body.caption.length > 1200)) return NextResponse.json({ error: 'Caption must be under 1200 characters.' }, { status: 400 })
  const requestedTime = body.scheduled_at
  if (requestedTime !== undefined && (!isSlot(requestedTime) || requestedTime < Date.now() + 30 * 60_000 || requestedTime > Date.now() + 119 * 86400_000)) {
    return NextResponse.json({ error: 'Choose a 6 AM, noon or 6 PM El Paso slot at least 30 minutes ahead, within 119 days.' }, { status: 400 })
  }
  const ref = queueCollection().doc(body.id)
  const changed = await adminDb.runTransaction(async tx => {
    const [snap, control] = await Promise.all([tx.get(ref), tx.get(queueControl())])
    const item = snap.data()
    if (!item) return false
    const allowed = ['queued', 'needs_review', 'reviewing', 'scheduled', 'paused']
    if (!allowed.includes(item.status)) return false
    const stopped = ['cancel', 'pause'].includes(body.action)
    const slots = { ...(control.data()?.slots || {}) }
    if (slots[String(item.scheduled_at)] === body.id) delete slots[String(item.scheduled_at)]
    let scheduled_at = item.scheduled_at || null
    if (!stopped) {
      if (requestedTime && slots[String(requestedTime)]) return false
      const reservation = reserveSlot({ slots }, body.id, Date.now(), requestedTime)
      scheduled_at = reservation.scheduled_at
      // set whole map, not merge, so releasing a slot really removes it.
      tx.set(queueControl(), { ...control.data(), slots: reservation.slots })
    } else tx.set(queueControl(), { ...control.data(), slots })
    tx.update(ref, { status: stopped ? (body.action === 'cancel' ? 'cancelled' : 'paused') : 'queued', scheduled_at,
      ...(body.notes !== undefined ? { notes: safeNotes(body.notes) } : {}),
      ...(article_url !== undefined ? { article_url } : {}),
      ...(body.caption !== undefined ? { caption_override: body.caption.trim() } : {}),
      ...(!stopped ? { caption: '', reviews: [], reviewed_at: null } : {}),
      reason: stopped ? 'Stopped by administrator' : 'Requested fresh independent review for the new schedule/content', updated_at: Date.now(), updated_by: auth.user!.id })
    return true
  })
  if (!changed) return NextResponse.json({ error: 'Item cannot be changed in its current state. Uncertain posts cannot be automatically retried.' }, { status: 409 })
  const status = body.action === 'cancel' ? 'cancelled' : body.action === 'pause' ? 'paused' : 'queued'
  return NextResponse.json({ ok: true, status })
}
