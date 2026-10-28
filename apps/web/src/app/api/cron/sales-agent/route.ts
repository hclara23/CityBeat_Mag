import { NextRequest, NextResponse } from 'next/server'
import { HALT_AFTER_CONSECUTIVE_FAILURES, runSalesOutreach, runRecoveryOutreach } from '@/lib/sales-agent'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    // A rejected BEARER token is our own scheduler running against a rotated or
    // mistyped CRON_SECRET. That silences EVERY job at once, before any of their
    // try/catch blocks can report anything — the whole automation engine stops and
    // the only symptom is that nothing happens. Report it from the 401 itself.
    await reportCronAuthRejected('cron:sales-agent', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  try {
    // Language. `?locale=en|es` forces one language for the whole run. Left off,
    // each new listing is assigned one by hash (lib/sales-agent.ts outreachLocale)
    // and `?spanish=0.5` is the Spanish share — `?spanish=0` is the switch back to
    // English-only, `?spanish=1` all Spanish. Like `limit`, these live on the
    // Cloud Scheduler job's own URI, so changing them needs no deploy. Every send
    // used to be English because this defaulted to 'en' and the job never passed one.
    const forced = searchParams.get('locale')
    const spanishRaw = searchParams.get('spanish')
    const spanishShare = spanishRaw === null || spanishRaw.trim() === '' ? undefined : Number(spanishRaw)
    const result = await runSalesOutreach({
      limit: Number(searchParams.get('limit')) || 25,
      dryRun,
      locale: forced === 'en' || forced === 'es' ? forced : undefined,
      spanishShare: spanishShare !== undefined && Number.isFinite(spanishShare) ? spanishShare : undefined,
    })
    // Mid-funnel recovery rides the same daily run: abandoned verifications and
    // claimed-but-basic owners each get one nudge, tracked in recovery_outreach.
    const recovery = await runRecoveryOutreach({ limit: 20, dryRun })
    // A preview is not a run. Stamping liveness here made a hand-run ?dryRun=1
    // look like the scheduler had fired: it hides a stopped job from the heartbeat
    // for its whole budget, and flips a genuinely 'failing' source back to ok with
    // an emailed "recovered" note although nothing was sent. This job reported
    // "ok" every morning through twelve days of sending nothing; the stamp has to
    // mean "the scheduled run completed". (payout-cycle and reconcile-payouts
    // already guard it the same way.)
    if (!dryRun) await reportSuccess('cron:sales-agent')
    // The run stopped itself because sends kept failing. That is the provider or
    // our key, not the queue, and nothing else says so: the job still "ran".
    // skipHealth keeps the liveness stamp above meaning only "the job ran".
    if (!dryRun && (result.halted || recovery.halted)) {
      await reportFailure(
        'cron:sales-agent',
        new Error(`outreach stopped early after ${HALT_AFTER_CONSECUTIVE_FAILURES} consecutive send failures (${result.last_send_error || 'see recovery'})`),
        { halted_new_contacts: Boolean(result.halted), halted_recovery: Boolean(recovery.halted) },
        { skipHealth: true, alertKey: 'sales-agent-send-failures' }
      ).catch(() => {})
    }
    return NextResponse.json({ ...result, recovery })
  } catch (error) {
    if (!dryRun) await reportFailure('cron:sales-agent', error)
    return NextResponse.json({ error: 'Outreach run failed' }, { status: 500 })
  }
}
