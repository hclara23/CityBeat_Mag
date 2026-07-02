import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

// Creates an UNPAID draft job posting. The caller then runs Stripe Checkout with
// productId = the returned job id + type 'job'; the Stripe webhook publishes it
// (is_paid, expires_at) on successful payment.
export async function POST(request: NextRequest) {
  // Throttle anonymous draft creation to prevent Firestore write spam.
  const rl = await checkRateLimit(`job-create:ip:${getClientIp(request)}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const company_name = typeof body.company_name === 'string' ? body.company_name.trim() : ''
  const location = typeof body.location === 'string' ? body.location.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const apply_url = typeof body.apply_url === 'string' ? body.apply_url.trim() : ''
  const contact_email = typeof body.contact_email === 'string' ? body.contact_email.trim() : ''

  if (!title || !company_name || !description) {
    return NextResponse.json({ error: 'Title, company, and description are required.' }, { status: 400 })
  }

  try {
    const ref = await adminDb.collection('jobs').add({
      title,
      company_name,
      location: location || 'El Paso, TX',
      description,
      apply_url: apply_url || null,
      contact_email: contact_email || null,
      status: 'draft',
      is_paid: false,
      payment_status: 'unpaid',
      created_at: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true, jobId: ref.id }, { status: 201 })
  } catch (error: any) {
    console.error('create job error:', error)
    return NextResponse.json({ error: 'Could not create job posting' }, { status: 500 })
  }
}
