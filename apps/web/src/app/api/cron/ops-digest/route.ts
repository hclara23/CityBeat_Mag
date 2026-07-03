import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'morningstarelp@gmail.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function toMs(v: any): number {
  if (!v) return 0
  if (v?.toDate) return v.toDate().getTime()
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

// Weekly "what your machine did" digest to the operator. An unattended business
// needs a one-glance heartbeat: money in, funnel movement, content shipped, and
// anything that broke — without logging into three dashboards.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'

  try {
    const since = Date.now() - 7 * 86400000
    const inWindow = (v: any) => toMs(v) >= since

    const [payments, outreach, recovery, claims, listings, quotes, subs, alerts] = await Promise.all([
      adminDb.collection('payments').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('sales_outreach').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('recovery_outreach').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('directory_claims').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('directory_listings').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('quote_requests').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('newsletter_subscribers').get().catch(() => ({ docs: [] as any[] })),
      adminDb.collection('system_alerts').get().catch(() => ({ docs: [] as any[] })),
    ])

    const weekPayments = (payments.docs as any[]).map((d) => d.data()).filter((p) => inWindow(p.created_at) && p.status === 'paid')
    const revenueCents = weekPayments.reduce((s, p) => s + (p.amount || 0), 0)

    const o = (outreach.docs as any[]).map((d) => d.data())
    const outreachSent = o.filter((x) => inWindow(x.last_sent_at)).length
    const outreachOpened = o.filter((x) => inWindow(x.last_sent_at) && (x.opens || 0) > 0).length
    const outreachClicked = o.filter((x) => inWindow(x.last_sent_at) && (x.clicks || 0) > 0).length
    const converted = o.filter((x) => x.status === 'converted' && inWindow(x.converted_at)).length

    const recoverySent = (recovery.docs as any[]).map((d) => d.data()).filter((x) => inWindow(x.created_at)).length

    const c = (claims.docs as any[]).map((d) => d.data())
    const claimsStarted = c.filter((x) => inWindow(x.created_at)).length
    const claimsVerified = c.filter((x) => x.status === 'verified' && inWindow(x.updated_at)).length

    const l = (listings.docs as any[]).map((d) => d.data())
    const newListings = l.filter((x) => inWindow(x.created_at)).length
    const pendingApproval = l.filter((x) => x.claim_status === 'pending_approval').length
    const paying = l.filter((x) => ['premium', 'featured'].includes(x.tier)).length

    const weekLeads = (quotes.docs as any[]).map((d) => d.data()).filter((x) => inWindow(x.created_at)).length
    const totalSubs = (subs.docs as any[]).map((d) => d.data()).filter((s) => s.status !== 'unsubscribed').length
    const weekAlerts = (alerts.docs as any[]).map((d) => d.data()).filter((x) => inWindow(x.created_at))
    const alertSources = [...new Set(weekAlerts.map((a) => a.source))].slice(0, 5)

    // What people asked the concierge this week — warm leads + product signal.
    const chatSnap = await adminDb.collection('chat_sessions').get().catch(() => ({ docs: [] as any[] }))
    const questions = (chatSnap.docs as any[])
      .map((d) => d.data())
      .filter((c) => inWindow(c.created_at) && c.last_user_message)
      .slice(-8)
      .map((c) => String(c.last_user_message).slice(0, 120))

    const row = (label: string, value: string | number, hint = '') =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${label}${hint ? `<br/><span style="font-size:11px;color:#aaa">${hint}</span>` : ''}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:20px;font-weight:800">${value}</td></tr>`

    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h1 style="font-weight:900;font-size:24px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span> · ops digest</h1>
  <p style="color:#666;font-size:13px;margin:0 0 20px">What your machine did in the last 7 days</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Revenue collected', `$${(revenueCents / 100).toFixed(2)}`, 'paid invoices')}
    ${row('Paying listings (total)', paying)}
    ${row('Outbound emails sent', outreachSent, `${outreachOpened} opened · ${outreachClicked} clicked`)}
    ${row('Outreach conversions', converted, 'listings that paid after outreach')}
    ${row('Recovery nudges sent', recoverySent, 'abandoned claims + basic upsells')}
    ${row('Claims started / verified', `${claimsStarted} / ${claimsVerified}`)}
    ${row('Claims awaiting your approval', pendingApproval, pendingApproval > 0 ? `review at ${APP_URL}/en/admin/claims` : '')}
    ${row('New businesses ingested', newListings)}
    ${row('Customer leads captured', weekLeads)}
    ${row('Newsletter subscribers (total)', totalSubs)}
    ${row('Automation failures', weekAlerts.length, alertSources.length ? `sources: ${alertSources.join(', ')}` : 'all healthy')}
  </table>
  ${questions.length ? `<p style="margin:18px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999">What people asked the concierge</p>
  <ul style="font-size:13px;color:#555;margin:0;padding-left:18px">${questions.map((q) => `<li>${q.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : ''}
  <p style="margin:20px 0"><a href="${APP_URL}/en/admin" style="background:#22d3ee;color:#000;font-weight:800;padding:10px 20px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px;font-size:12px">Open admin</a></p>
</div>`

    let sent = false
    if (!dryRun) sent = (await sendEmail(ALERT_EMAIL, `CityBeat weekly: $${(revenueCents / 100).toFixed(0)} revenue, ${weekLeads} leads, ${claimsStarted} claims`, html)).sent

    await reportSuccess('cron:ops-digest')
    return NextResponse.json({
      ok: true,
      dryRun,
      sent,
      summary: {
        revenue_cents: revenueCents,
        paying_listings: paying,
        outreach_sent: outreachSent,
        converted,
        recovery_sent: recoverySent,
        claims_started: claimsStarted,
        claims_verified: claimsVerified,
        pending_approval: pendingApproval,
        new_listings: newListings,
        leads: weekLeads,
        subscribers: totalSubs,
        alerts: weekAlerts.length,
      },
    })
  } catch (error) {
    await reportFailure('cron:ops-digest', error)
    return NextResponse.json({ error: 'Ops digest failed' }, { status: 500 })
  }
}
