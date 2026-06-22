import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/supabase/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { runSalesOutreach, sendTestEmail } from '@/lib/sales-agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

export async function GET() {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [outreachSnap, unclaimedSnap] = await Promise.all([
    adminDb.collection('sales_outreach').get().catch(() => ({ docs: [] as any[], size: 0 })),
    adminDb
      .collection('directory_listings')
      .where('claim_status', '==', 'unclaimed')
      .count()
      .get()
      .then((s: any) => s.data().count)
      .catch(() => null),
  ])

  const rows = (outreachSnap.docs as any[]).map((d) => ({ id: d.id, ...d.data() }))
  const funnel = { contacted: rows.length, opened: 0, clicked: 0, converted: 0, sent: 0 }
  let totalOpens = 0
  let totalClicks = 0
  for (const r of rows) {
    totalOpens += r.opens || 0
    totalClicks += r.clicks || 0
    if (['sent', 'opened', 'clicked', 'converted'].includes(r.status)) funnel.sent++
    if (['opened', 'clicked', 'converted'].includes(r.status)) funnel.opened++
    if (['clicked', 'converted'].includes(r.status)) funnel.clicked++
    if (r.status === 'converted') funnel.converted++
  }

  const recent = rows
    .sort((a, b) => (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
    .slice(0, 50)
    .map((r) => ({ id: r.id, business_name: r.business_name, email: r.email, status: r.status, step: r.step, opens: r.opens, clicks: r.clicks }))

  return NextResponse.json({
    unclaimed_remaining: unclaimedSnap,
    funnel,
    totals: { opens: totalOpens, clicks: totalClicks },
    recent,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))

  // Verify the email channel by sending a sample to a chosen address.
  if (typeof body.testEmail === 'string' && body.testEmail.includes('@')) {
    const r = await sendTestEmail(body.testEmail, body.locale === 'es' ? 'es' : 'en')
    return NextResponse.json({ test: r })
  }

  const result = await runSalesOutreach({
    limit: Number(body.limit) || 10,
    dryRun: body.dryRun !== false, // default to dry-run for safety when triggered from the dashboard
    locale: body.locale === 'es' ? 'es' : 'en',
  })
  return NextResponse.json({ result })
}
