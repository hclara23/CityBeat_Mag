import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { readCronLiveness, reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import { collectedCents, purchaseRowCounts } from '@/lib/finance-rollup'
import { scanCollection } from '@/lib/firestore-scan'
import {
  CRON_EXPECTATIONS,
  REVENUE_BASELINE_DAYS,
  describeStaleCron,
  evaluateCronLiveness,
  evaluateRevenueHealth,
  type RevenueSignal,
} from '@/lib/ops-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// The deadman switch. Everything else in this system alerts from a catch block,
// which only fires when code RUNS — so the two failures that end the business
// were undetectable: a scheduled job that stops being invoked, and revenue that
// stops arriving. lib/ops-health.ts holds the reasoning and the rules; this
// route is the plumbing that feeds them and the thing that pages a human.
//
// Schedule it daily (Cloud Scheduler, `citybeat-heartbeat`, GET with the same
// `Authorization: Bearer ${CRON_SECRET}` header as every other job).
//
// It cannot detect its OWN non-execution — nothing self-hosted can. Two things
// cover that: `cron:heartbeat` is in CRON_EXPECTATIONS, so the weekly ops digest
// re-runs the same evaluation and catches a dead heartbeat; and the auth-reject
// detector below fires from the scheduler's own request when the mismatch is a
// rotated secret rather than a deleted job.

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function toMs(value: any): number {
  if (!value) return 0
  if (value?.toDate) return value.toDate().getTime()
  if (typeof value?._seconds === 'number') return value._seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || 0
  return 0
}

const DAY_MS = 86400000

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    // A caller that presented a bearer token we rejected is almost certainly our
    // own scheduler running against a rotated secret — the one failure mode that
    // silences every cron at once. See reportCronAuthRejected.
    await reportCronAuthRejected('cron:heartbeat', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'

  try {
    const now = Date.now()

    // --- Is the machine still running? -------------------------------------
    const { lastRunAtMs, trackingSinceMs } = await readCronLiveness({ createRegistry: !dryRun })
    const liveness = evaluateCronLiveness({
      nowMs: now,
      lastRunAtMs,
      trackingSinceMs,
      expectations: CRON_EXPECTATIONS,
    })

    // --- Is it still earning? ----------------------------------------------
    const revenue = await readRevenueSignal(now)
    // A scan that errored or hit its cap produces UNDERCOUNTED revenue, which
    // looks exactly like a revenue stop. Never page on numbers we know are
    // partial — a false "the business has stopped earning" alarm is how this
    // channel gets ignored on the day it is right.
    const verdict = revenue.complete
      ? evaluateRevenueHealth(revenue)
      : { status: 'quiet' as const, alert: false, reason: 'revenue scan incomplete — not judged' }

    if (!dryRun) {
      if (liveness.stale.length) {
        await reportFailure(
          'cron:liveness',
          new Error(
            `${liveness.stale.length} scheduled job(s) have stopped running: ${liveness.stale
              .map(describeStaleCron)
              .join('; ')}`
          ),
          { stale: liveness.stale.map((s) => s.source), on_time: liveness.onTime.length },
          // A dead scheduler means no other alert can reach anyone, so this is
          // the one that has to survive the operator not reading email.
          { escalate: true }
        )
      } else {
        await reportSuccess('cron:liveness')
      }

      if (verdict.alert) {
        await reportFailure('revenue:stalled', new Error(`Revenue ${verdict.status}: ${verdict.reason}`), {
          baseline_paid_rows_30d: revenue.baselineCount,
          current_week_cents: revenue.currentWindowCents,
          prior_week_cents: revenue.priorWindowCents,
        }, { escalate: true })
      } else {
        await reportSuccess('revenue:stalled')
      }

      // Stamps cron:heartbeat's own last_run_at, so a dead heartbeat is itself
      // detectable by the weekly digest running the same rules.
      await reportSuccess('cron:heartbeat')
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      liveness: {
        checked: liveness.checked,
        on_time: liveness.onTime.length,
        waiting: liveness.waiting,
        stale: liveness.stale.map(describeStaleCron),
        tracking_since: trackingSinceMs ? new Date(trackingSinceMs).toISOString() : null,
      },
      revenue: {
        status: verdict.status,
        alert: verdict.alert,
        reason: verdict.reason,
        scan_complete: revenue.complete,
        baseline_paid_rows_30d: revenue.baselineCount,
        current_week_cents: revenue.currentWindowCents,
        prior_week_cents: revenue.priorWindowCents,
      },
    })
  } catch (error) {
    await reportFailure('cron:heartbeat', error)
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 })
  }
}

/**
 * Liveness for agents that run OUTSIDE this app — today the Cloudflare worker's
 * brief-ingestion cron, whose only operational signal was a console.log in a
 * dashboard nobody opens.
 *
 * Authenticated with the shared INGEST_SECRET the worker already holds (the same
 * secret it uses for /api/ingest/brief), and the source is prefix-restricted so
 * this can never be used to fake a run for, or raise an alert about, one of the
 * in-app crons.
 *
 * Idempotent: reporting the same run twice re-stamps the same fields.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as any))
  const source = typeof body?.source === 'string' ? body.source.slice(0, 80) : ''
  // Only external agents may self-report, and only ones we already expect. An
  // arbitrary source would let a leaked ingest secret manufacture a page, or
  // silence a real job by stamping a run it never made.
  const known = CRON_EXPECTATIONS.some((e) => e.source === source && e.source.startsWith('worker:'))
  if (!known) return NextResponse.json({ error: 'Unknown source' }, { status: 400 })

  const failed = body?.status === 'failed'
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : 'reported a failure'
  const context =
    body?.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? (Object.fromEntries(Object.entries(body.context).slice(0, 12)) as Record<string, unknown>)
      : undefined

  if (failed) {
    // Stamp the run BEFORE the failure report: the worker did execute, and
    // conflating "ran and failed" with "never ran" would send the operator
    // looking at the scheduler instead of at the error.
    await adminDb
      .collection('system_health')
      .doc(source)
      .set({ last_run_at: FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => null)
    await reportFailure(source, new Error(message), context)
    return NextResponse.json({ ok: true, recorded: 'failed' })
  }

  await reportSuccess(source)
  return NextResponse.json({ ok: true, recorded: 'ok' })
}

/**
 * Collected revenue over the windows the rules need.
 *
 * Same two ledgers and the same counting rules as the weekly ops digest
 * (invoices in `payments`, one-time sales in `ad_purchases`, minus the
 * subscription rows that would double-count month one), so the heartbeat and the
 * digest can never disagree about whether money arrived.
 *
 * Streamed rather than materialised — `.get()` on these collections holds every
 * row in memory at once, and an OOM here kills an instance that is also serving
 * real visitors. The cost is a daily scan of two growing collections; that is
 * the price of noticing a revenue stop in a day instead of in a week.
 */
async function readRevenueSignal(nowMs: number): Promise<RevenueSignal & { complete: boolean }> {
  const baselineSince = nowMs - REVENUE_BASELINE_DAYS * DAY_MS
  const currentSince = nowMs - 7 * DAY_MS
  const priorSince = nowMs - 14 * DAY_MS

  let baselineCount = 0
  let lastPaidMs = 0
  let currentWindowCents = 0
  let priorWindowCents = 0

  const record = (createdMs: number, cents: number) => {
    if (createdMs >= baselineSince) baselineCount++
    if (createdMs > lastPaidMs) lastPaidMs = createdMs
    if (createdMs >= currentSince) currentWindowCents += cents
    else if (createdMs >= priorSince) priorWindowCents += cents
  }

  // A scan that throws must NOT come back as "no revenue" — that is a Firestore
  // outage reported to the operator as the business having stopped selling.
  let complete = true
  const track = (work: Promise<{ truncated: boolean }>) =>
    work.then((r) => {
      if (r.truncated) complete = false
    }).catch(() => {
      complete = false
    })

  await Promise.all([
    track(
      scanCollection(adminDb.collection('payments'), (d) => {
        const p = d.data() as any
        if (p.status !== 'paid') return
        record(toMs(p.created_at), collectedCents(p))
      })
    ),

    track(
      scanCollection(adminDb.collection('ad_purchases'), (d) => {
        const p = d.data() as any
        if (p.payment_status !== 'completed' || !purchaseRowCounts(p)) return
        record(toMs(p.created_at), Number(p.amount_total) || 0)
      })
    ),
  ])

  return {
    baselineCount,
    msSinceLastPaid: lastPaidMs ? nowMs - lastPaidMs : null,
    currentWindowCents,
    priorWindowCents,
    complete,
  }
}
