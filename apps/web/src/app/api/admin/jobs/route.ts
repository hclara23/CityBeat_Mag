import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { sendEmail } from '@/lib/email'
import { moderationOutcomeEmail } from '@/lib/buyer-emails'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

// Sales-desk-visible, not admin-only: a rep who sold a job posting needs to be
// able to see and approve it going live without a developer in the loop —
// there's no ownership-dispute risk here the way a directory claim has.
async function requireSalesAccess() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  // The admin PAGES force 2FA enrollment (both route-group layouts); these
  // APIs approve paid content and must not accept a password-only session.
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

export async function GET() {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const snap = await adminDb.collection('jobs').orderBy('created_at', 'desc').limit(300).get()
    const jobs = snap.docs.map((d) => {
      const data = d.data() as any
      return { id: d.id, ...data, created_at: toIso(data.created_at), expires_at: toIso(data.expires_at) || data.expires_at || null }
    })
    return NextResponse.json({ jobs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

const JOB_POSTING_DAYS = 30

// Approve: goes live for JOB_POSTING_DAYS from THIS moment (not from purchase —
// a posting that sat in review for a few days shouldn't lose those days off its
// paid run). Reject: stays off the board; payment/commission are untouched —
// see the sales-order refund flow for actually reversing a bad sale.
export async function PATCH(request: NextRequest) {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : ''
  if (!id || !action) return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })

  const now = new Date().toISOString()
  const updates =
    action === 'approve'
      ? {
          is_active: true,
          status: 'published',
          payment_status: 'paid',
          published_at: now,
          expires_at: new Date(Date.now() + JOB_POSTING_DAYS * 86400000).toISOString(),
          moderated_by: auth.user.id,
          moderated_at: now,
          updated_at: now,
        }
      : {
          is_active: false,
          status: 'rejected',
          // The public board filters on is_paid + expires_at (index-backed)
          // and never reads status/is_active — so a rejected posting used to
          // stay listed for its full 30 days. Expiring it is the index-free
          // takedown.
          expires_at: now,
          moderated_by: auth.user.id,
          moderated_at: now,
          updated_at: now,
        }

  try {
    const ref = adminDb.collection('jobs').doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    await ref.set(updates, { merge: true })

    // Tell the buyer the outcome — nobody was notified of approval OR
    // rejection before, on either purchase path. Best-effort.
    try {
      const job = existing.data() as any
      const to = job.application_email || job.contact_email
      if (to) {
        const { subject, html } = moderationOutcomeEmail({
          itemLabel: job.title,
          kindLabelEn: 'job posting',
          kindLabelEs: 'oferta de empleo',
          approved: action === 'approve',
          liveUntil: action === 'approve' ? (updates as any).expires_at : undefined,
          publicUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'}/en/jobs`,
        })
        await sendEmail(String(to), subject, html)
      }
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, ...updates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
