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
import { readCronLiveness, reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import {
  CRON_EXPECTATIONS,
  describeStaleCron,
  evaluateCronLiveness,
  evaluateRevenueHealth,
  parseAlertRecipients,
} from '@/lib/ops-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

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
  if (!authorized(request)) {
    // A rejected BEARER token is our own scheduler running against a rotated
    // CRON_SECRET — the failure that silences all 19 jobs at once, before any
    // of their try/catch blocks. See reportCronAuthRejected.
    await reportCronAuthRejected('cron:ops-digest', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'

  try {
    const now = Date.now()
    const since = now - 7 * 86400000
    const priorSince = now - 14 * 86400000
    const inWindow = (v: any) => toMs(v) >= since
    // The 7 days BEFORE the reported week. Revenue used to be a bare number with
    // nothing to compare it against, so a collapse read the same as a good week
    // unless the operator happened to remember last Friday's figure.
    const inPriorWindow = (v: any) => {
      const t = toMs(v)
      return t >= priorSince && t < since
    }

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
    let revenuePrior = 0
    let paidRows30d = 0
    let lastPaidMs = 0
    const weekAlerts: any[] = []
    const questions: string[] = []
    const baselineSince = now - 30 * 86400000

    // Feeds the same revenue rules the daily heartbeat runs, so the digest and
    // the heartbeat can never disagree about whether money is still arriving.
    const recordPaid = (createdAtMs: number) => {
      if (createdAtMs >= baselineSince) paidRows30d++
      if (createdAtMs > lastPaidMs) lastPaidMs = createdAtMs
    }

    // A revenue scan that throws or truncates undercounts, which is
    // indistinguishable from money having stopped. Track it so the health
    // verdict below can decline to judge rather than raise a false alarm about
    // the business having died. (The other scans keep their existing
    // best-effort behaviour: an undercounted lead tally is cosmetic.)
    let revenueScanComplete = true
    const trackRevenueScan = (work: Promise<{ truncated: boolean }>) =>
      work.then((r) => {
        if (r.truncated) revenueScanComplete = false
      }).catch(() => {
        revenueScanComplete = false
      })

    await Promise.all([
      trackRevenueScan(
        scanCollection(adminDb.collection('payments'), (d) => {
          const p = d.data() as any
          if (p.status !== 'paid') return
          if (inWindow(p.created_at)) revenueInvoices += collectedCents(p)
          else if (inPriorWindow(p.created_at)) revenuePrior += collectedCents(p)
          recordPaid(toMs(p.created_at))
        })
      ),

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
      trackRevenueScan(
        scanCollection(adminDb.collection('ad_purchases'), (d) => {
          const p = d.data() as any
          if (p.payment_status !== 'completed' || !purchaseRowCounts(p)) return
          const createdAt = toIsoLike(p.created_at)
          const cents = Number(p.amount_total) || 0
          if (inWindow(createdAt)) revenueOneTime += cents
          else if (inPriorWindow(createdAt)) revenuePrior += cents
          recordPaid(toMs(createdAt))
        })
      ),

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

    // The heartbeat runs these same two evaluations daily. Repeating them here
    // is deliberate: this digest is the ONE message the operator reliably reads,
    // and it used to derive "all healthy" purely from the absence of rows that a
    // job which never runs never creates — so a scheduler that had stopped
    // invoking everything read as a perfect week. Re-running the rules means the
    // digest also catches a heartbeat that has itself stopped.
    //
    // Creates the tracking registry if the heartbeat job has not yet been added
    // to Cloud Scheduler, so liveness arms itself from whichever cron runs
    // first. Otherwise a forgotten `citybeat-heartbeat` job would leave the
    // registry missing and every source permanently "not yet judgeable" — an
    // alerting feature that is silently switched off, which is what this whole
    // change exists to stop.
    const { lastRunAtMs, trackingSinceMs } = await readCronLiveness({ createRegistry: !dryRun }).catch(() => ({
      lastRunAtMs: {} as Record<string, number | null>,
      trackingSinceMs: null as number | null,
    }))
    const liveness = evaluateCronLiveness({
      nowMs: now,
      lastRunAtMs,
      trackingSinceMs,
      expectations: CRON_EXPECTATIONS,
    })
    const revenueVerdict = revenueScanComplete
      ? evaluateRevenueHealth({
          baselineCount: paidRows30d,
          msSinceLastPaid: lastPaidMs ? now - lastPaidMs : null,
          currentWindowCents: revenueCents,
          priorWindowCents: revenuePrior,
        })
      : { status: 'quiet' as const, alert: false, reason: 'revenue scan incomplete — not judged' }
    const degraded = liveness.stale.length > 0 || revenueVerdict.alert

    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c)
    const trend =
      revenuePrior > 0
        ? `${revenueCents >= revenuePrior ? '▲' : '▼'} vs $${(revenuePrior / 100).toFixed(2)} last week`
        : 'no revenue recorded last week'

    const row = (label: string, value: string | number, hint = '') =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${label}${hint ? `<br/><span style="font-size:11px;color:#aaa">${hint}</span>` : ''}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:20px;font-weight:800">${value}</td></tr>`

    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h1 style="font-weight:900;font-size:24px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span> · ops digest</h1>
  <p style="color:#666;font-size:13px;margin:0 0 20px">What your machine did in the last 7 days</p>
  ${degraded ? `<div style="background:#fee2e2;border-left:4px solid #dc2626;padding:12px 14px;margin:0 0 18px;font-size:13px;color:#7f1d1d">
    <strong style="display:block;margin-bottom:4px">Needs attention</strong>
    ${revenueVerdict.alert ? `<div>Revenue ${esc(revenueVerdict.status)}: ${esc(revenueVerdict.reason)}</div>` : ''}
    ${liveness.stale.length ? `<div>${liveness.stale.length} scheduled job(s) have stopped running:<ul style="margin:4px 0 0;padding-left:18px">${liveness.stale.map((s) => `<li>${esc(describeStaleCron(s))}</li>`).join('')}</ul></div>` : ''}
  </div>` : ''}
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Revenue collected', `$${(revenueCents / 100).toFixed(2)}`, `invoices + one-time sales · ${esc(trend)}`)}
    ${row('Paying listings (total)', paying)}
    ${row('Outbound emails sent', outreachSent, `${outreachOpened} opened · ${outreachClicked} clicked`)}
    ${row('Outreach conversions', converted, 'listings that paid after outreach')}
    ${row('Recovery nudges sent', recoverySent, 'abandoned claims + basic upsells')}
    ${row('Claims started / verified', `${claimsStarted} / ${claimsVerified}`)}
    ${row('Claims awaiting your approval', pendingApproval, pendingApproval > 0 ? `review at ${APP_URL}/en/admin/claims` : '')}
    ${row('New businesses ingested', newListings)}
    ${row('Customer leads captured', weekLeads)}
    ${row('Newsletter subscribers (total)', totalSubs)}
    ${row('Automation failures', weekAlerts.length, alertSources.length ? `sources: ${esc(alertSources.join(', '))}` : 'no failure reported')}
    ${row(
      'Scheduled jobs on time',
      `${liveness.onTime.length}/${liveness.checked}`,
      // NEVER print "all healthy" without evidence: that claim is exactly what
      // made a dead scheduler invisible for as long as nobody looked.
      liveness.stale.length
        ? `stopped: ${esc(liveness.stale.map((s) => s.source).join(', '))}`
        : liveness.waiting.length
          ? `${liveness.waiting.length} not yet judgeable (${esc(liveness.waiting.join(', '))})`
          : 'every scheduled job ran within its window'
    )}
  </table>
  ${questions.length ? `<p style="margin:18px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999">What people asked the concierge</p>
  <ul style="font-size:13px;color:#555;margin:0;padding-left:18px">${questions.map((q) => `<li>${q.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : ''}
  <p style="margin:20px 0"><a href="${APP_URL}/en/admin" style="background:#22d3ee;color:#000;font-weight:800;padding:10px 20px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px;font-size:12px">Open admin</a></p>
</div>`

    // The digest goes to every address in ALERT_EMAIL, not just the first one —
    // a single unmonitored personal mailbox was the whole reporting channel.
    const subject = `${degraded ? '⚠️ ' : ''}CityBeat weekly: $${(revenueCents / 100).toFixed(0)} revenue, ${weekLeads} leads, ${claimsStarted} claims`
    let sent = false
    if (!dryRun) {
      const results = await Promise.all(
        parseAlertRecipients(process.env.ALERT_EMAIL).map((to) =>
          sendEmail(to, subject, html).catch(() => ({ sent: false }))
        )
      )
      sent = results.some((r) => r.sent)
    }

    // The digest must not be the only place a stopped job or a revenue stop is
    // reported — it is weekly, and a reader who skims it learns nothing. Raise
    // it through the same alert path everything else uses.
    //
    // skipHealth, and the alertKey set to the heartbeat's own source names: the
    // `cron:liveness` / `revenue:stalled` health states belong to the daily
    // heartbeat because it is the only caller that also calls reportSuccess on
    // them, and a source nothing ever clears sits failing forever (the same trap
    // bug:client documents). Sharing the dedupe bucket also stops the digest and
    // the heartbeat from double-emailing about one finding.
    if (!dryRun && degraded) {
      const detail = [
        revenueVerdict.alert ? `revenue ${revenueVerdict.status}: ${revenueVerdict.reason}` : '',
        liveness.stale.length ? `stopped jobs: ${liveness.stale.map(describeStaleCron).join('; ')}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
      await reportFailure('cron:ops-digest-findings', new Error(detail), undefined, {
        skipHealth: true,
        alertKey: liveness.stale.length ? 'cron:liveness' : 'revenue:stalled',
        escalate: true,
      })
    }

    await reportSuccess('cron:ops-digest')
    return NextResponse.json({
      ok: true,
      dryRun,
      sent,
      degraded,
      liveness: {
        on_time: liveness.onTime.length,
        checked: liveness.checked,
        waiting: liveness.waiting,
        stale: liveness.stale.map(describeStaleCron),
      },
      revenue_health: { status: revenueVerdict.status, alert: revenueVerdict.alert, reason: revenueVerdict.reason },
      summary: {
        revenue_cents: revenueCents,
        revenue_cents_prior_week: revenuePrior,
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
