import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import {
  CLAIM_REVIEW_TARGET_HOURS,
  agingClaimsSummary,
  agingPaidClaims,
} from '@/lib/claims-aging'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// Pages a human when a business has PAID for a directory claim and nobody has
// approved it.
//
// The approval gate itself is correct: it is what stops someone buying the
// Sponsored slot on a business they have nothing to do with. What was missing is
// that it is performed by hand, by one person, with auto-approval off by default,
// and NOTHING noticed when it did not happen. The customer's card is charged at
// checkout. If the operator is ill, travelling, or just busy for two weeks, that
// business has paid and received nothing, and the only surface showing it was a
// count in a weekly digest — which is not a signal, it is a statistic.
//
// This is the same failure the rest of today's work keeps finding: money taken,
// obligation created, nobody told.
//
//   ?hours=N   override the review target (default 48)
//   ?dryRun=1  report without alerting

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Pending claims are a short list by nature; the cap is a runaway guard, not a
// business rule, and hitting it is itself reported.
const SCAN_LIMIT = 500

export async function GET(request: NextRequest) {
  // A rejected BEARER token is our own scheduler running against a rotated or
  // mistyped CRON_SECRET. That silences EVERY job at once, before any of their
  // try/catch blocks can report anything — the whole automation engine stops and
  // the only symptom is that nothing happens. Report it from the 401 itself.
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:claims-aging', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const targetHours =
    Math.max(1, parseInt(searchParams.get('hours') || '', 10) || CLAIM_REVIEW_TARGET_HOURS)

  try {
    // Single equality filter, so this is served by the automatic index — no
    // composite index that has to exist before the query works, on a check whose
    // whole job is to still run when things are going wrong.
    const snap = await adminDb
      .collection('directory_listings')
      .where('claim_status', '==', 'pending_approval')
      .limit(SCAN_LIMIT)
      .get()

    const claims = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    const aging = agingPaidClaims(claims, new Date(), targetHours)
    const breached = aging.filter((c) => c.breached)

    if (!dryRun) {
      if (aging.length > 0) {
        await reportFailure(
          'claims-aging',
          new Error(agingClaimsSummary(aging)),
          {
            target_hours: targetHours,
            overdue: aging.length,
            breached: breached.length,
            pending_total: claims.length,
            // Enough to act on without opening a dashboard.
            worst: aging.slice(0, 10).map((c) => ({
              id: c.id,
              name: c.name,
              days_waiting: c.hours_waiting === -1 ? 'unknown' : Math.floor(c.hours_waiting / 24),
              contact_email: c.contact_email,
            })),
          },
          // Its own dedupe bucket: a standing backlog must not use up the alert
          // budget that a sudden failure elsewhere needs.
          { alertKey: 'claims-aging' }
        ).catch(() => {})
      } else {
        await reportSuccess('claims-aging')
      }

      // Liveness is stamped on every successful run, under its own `cron:` source,
      // and deliberately NOT conditioned on there being no backlog. The health
      // flag above uses 'claims-aging' and stays failing while claims are overdue —
      // which is correct — but a backlog can legitimately persist for days, and if
      // that also suppressed the liveness stamp the job would be reported STALE on
      // top of its real alert, as though the cron had stopped running.
      await reportSuccess('cron:claims-aging')

      if (claims.length >= SCAN_LIMIT) {
        await reportFailure(
          'claims-aging-scan-cap',
          new Error(
            `The pending-claims scan hit its ${SCAN_LIMIT}-document cap, so this run did not see every pending claim.`
          ),
          { limit: SCAN_LIMIT }
        ).catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      target_hours: targetHours,
      pending_total: claims.length,
      overdue: aging.length,
      breached: breached.length,
      truncated: claims.length >= SCAN_LIMIT,
      summary: agingClaimsSummary(aging),
      claims: aging.slice(0, 50),
    })
  } catch (error: any) {
    await reportFailure('claims-aging', error, { target_hours: targetHours }).catch(() => {})
    return NextResponse.json(
      { error: 'Could not check pending claims', reason: String(error?.message || error).slice(0, 300) },
      { status: 500 }
    )
  }
}
