import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { collectedCents, purchaseRowCounts } from '@/lib/finance-rollup'
import { scanCollection } from '@/lib/firestore-scan'

// ad_purchases created_at is a Firestore Timestamp (serverTimestamp), unlike
// payments' ISO strings — normalize before the window check.
function toIsoLike(value: any): string {
  if (value?.toDate) return value.toDate().toISOString()
  if (value?._seconds) return new Date(value._seconds * 1000).toISOString()
  return typeof value === 'string' ? value : ''
}
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

    // Every one of these used to be a `.get()` on a WHOLE collection, with all
    // ten snapshots alive at the same moment — directory_listings among them,
    // thousands of rows that grow every night from the scraper. Nothing here
    // needs a document after it has been counted, so each is streamed into
    // counters instead. Same numbers, memory that no longer scales with the
    // size of the business. An OOM here kills the instance, and the instance is
    // also serving real visitors.
    let revenueInvoices = 0
    let outreachSent = 0
    let outreachOpened = 0
    let outreachClicked = 0
    let converted = 0
    let recoverySent = 0
    let claimsStarted = 0
    let claimsVerified = 0
    let newListings = 0
    let pendingApproval = 0
    let paying = 0
    let weekLeads = 0
    let totalSubs = 0
    let revenueOneTime = 0
    const weekAlerts: any[] = []
    const questions: string[] = []

    await Promise.all([
      scanCollection(adminDb.collection('payments'), (d) => {
        const p = d.data() as any
        if (inWindow(p.created_at) && p.status === 'paid') revenueInvoices += collectedCents(p)
      }).catch(() => null),

      scanCollection(adminDb.collection('sales_outreach'), (d) => {
        const x = d.data() as any
        if (inWindow(x.last_sent_at)) {
          outreachSent++
          if ((x.opens || 0) > 0) outreachOpened++
          if ((x.clicks || 0) > 0) outreachClicked++
        }
        if (x.status === 'converted' && inWindow(x.converted_at)) converted++
      }).catch(() => null),

      scanCollection(adminDb.collection('recovery_outreach'), (d) => {
        if (inWindow((d.data() as any).created_at)) recoverySent++
      }).catch(() => null),

      scanCollection(adminDb.collection('directory_claims'), (d) => {
        const x = d.data() as any
        if (inWindow(x.created_at)) claimsStarted++
        if (x.status === 'verified' && inWindow(x.updated_at)) claimsVerified++
      }).catch(() => null),

      scanCollection(adminDb.collection('directory_listings'), (d) => {
        const x = d.data() as any
        if (inWindow(x.created_at)) newListings++
        if (x.claim_status === 'pending_approval') pendingApproval++
        // Real paying listings only — house/showcase accounts carry no revenue.
        if (['premium', 'featured'].includes(x.tier) && !x.is_house_account) paying++
      }).catch(() => null),

      scanCollection(adminDb.collection('quote_requests'), (d) => {
        if (inWindow((d.data() as any).created_at)) weekLeads++
      }).catch(() => null),

      scanCollection(adminDb.collection('newsletter_subscribers'), (d) => {
        if ((d.data() as any).status !== 'unsubscribed') totalSubs++
      }).catch(() => null),

      scanCollection(adminDb.collection('system_alerts'), (d) => {
        const x = d.data() as any
        if (inWindow(x.created_at)) weekAlerts.push(x)
      }).catch(() => null),

      // One-time products (jobs, featured events, sponsored stories, custom)
      // never produce an invoice, so a week of only one-time sales used to read
      // $0 here — making a REAL revenue stop invisible. Subscription-backed rows
      // are excluded; their money arrives as invoices and counting both
      // double-counts month one.
      scanCollection(adminDb.collection('ad_purchases'), (d) => {
        const p = d.data() as any
        if (inWindow(toIsoLike(p.created_at)) && p.payment_status === 'completed' && purchaseRowCounts(p)) {
          revenueOneTime += Number(p.amount_total) || 0
        }
      }).catch(() => null),

      // What people asked the concierge this week — warm leads + product signal.
      scanCollection(adminDb.collection('chat_sessions'), (d) => {
        const c = d.data() as any
        if (!inWindow(c.created_at) || !c.last_user_message) return
        questions.push(String(c.last_user_message).slice(0, 120))
        if (questions.length > 8) questions.shift()
      }).catch(() => null),
    ])

    const revenueCents = revenueInvoices + revenueOneTime
    const alertSources = [...new Set(weekAlerts.map((a) => a.source))].slice(0, 5)

    const row = (label: string, value: string | number, hint = '') =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${label}${hint ? `<br/><span style="font-size:11px;color:#aaa">${hint}</span>` : ''}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:20px;font-weight:800">${value}</td></tr>`

    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h1 style="font-weight:900;font-size:24px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span> · ops digest</h1>
  <p style="color:#666;font-size:13px;margin:0 0 20px">What your machine did in the last 7 days</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Revenue collected', `$${(revenueCents / 100).toFixed(2)}`, 'invoices + one-time sales')}
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
