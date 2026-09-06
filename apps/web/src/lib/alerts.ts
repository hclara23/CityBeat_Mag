import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from './email'
import { checkRateLimit } from './auth-security'
import { parseAlertRecipients, DEFAULT_ALERT_EMAIL } from './ops-health'
import { sendSms } from './sms'

// Operational alerting for the unattended automation. When a cron or the Stripe
// webhook fails, the machine must tell a human — logs nobody reads don't count.
// Every failure is written to `system_alerts`; an email goes to every address in
// ALERT_EMAIL, deduped per source (max 3 per 6h) so a crashloop can't flood the
// inbox.
//
// `system_health/{source}` additionally carries `last_run_at` — the ONLY record
// anywhere of when a scheduled job last executed. See lib/ops-health.ts for why
// that record has to exist and what reads it.

// Read at call time, not at module load, so adding a co-responder is an env-var
// edit on the Cloud Run service rather than a code change and a deploy.
// ALERT_EMAIL accepts a comma/semicolon/whitespace-separated LIST: alerting used
// to fan out to exactly one hardcoded personal mailbox, so an operator who was
// unreachable for two weeks meant every alert in the system reached nobody.
function alertRecipients(): string[] {
  return parseAlertRecipients(process.env.ALERT_EMAIL, DEFAULT_ALERT_EMAIL)
}

// Fan an alert out to every recipient. One bad address must not swallow the
// alert to the others, so each send is independent and "sent" means at least
// one landed.
async function sendAlertEmail(subject: string, html: string) {
  const recipients = alertRecipients()
  const results = await Promise.all(
    recipients.map((to) => sendEmail(to, subject, html).catch(() => ({ sent: false })))
  )
  const delivered = results.filter((r) => r.sent).length
  if (!delivered) console.error(`[alert] email delivery failed for all ${recipients.length} recipient(s)`)
  return { sent: delivered > 0, delivered, recipients: recipients.length }
}

// Second CHANNEL, not just a second address. Email needs Firestore and the mail
// provider — which is exactly what may be broken — so the alerts that mean the
// business has stopped can also go out over Twilio. Dormant until ALERT_SMS_TO
// is set (lib/sms.ts is itself dormant until the Twilio vars exist), so this is
// a no-op rather than a failure on a service that hasn't configured it.
async function escalateBySms(text: string) {
  const numbers = String(process.env.ALERT_SMS_TO || '')
    .split(/[,;\s]+/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 5)
  if (!numbers.length) return
  await Promise.all(numbers.map((to) => sendSms(to, text).catch(() => ({ sent: false })))).catch(() => null)
}

// Alert bodies used to interpolate first-party strings only (crons, the Stripe
// webhook). Client bug reports now flow in from a PUBLIC endpoint, so an
// unescaped message would let anyone put a live phishing link inside a genuine
// alert email sent from our own domain.
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Records that `source` just completed successfully, and — if it had been
// failing — clears that state and emails a one-line "recovered" note, so a red
// alert in the inbox is known-resolved without asking anyone.
//
// `last_run_at` is stamped on EVERY call, which is the whole point. This used to
// return early when the source wasn't already failing, so a healthy cron wrote
// nothing at all: there was no record anywhere in the system of when any
// scheduled job last ran, and a job that simply stopped being invoked (rotated
// CRON_SECRET, paused scheduler job, lost run.invoker) produced zero signal
// forever while /api/cron/heartbeat and the weekly digest both reported healthy.
// /api/cron/heartbeat reads these stamps; lib/ops-health.ts decides on them.
//
// Idempotent by construction: replaying the same run just re-stamps the same
// fields with a later timestamp.
export async function reportSuccess(source: string) {
  try {
    const ref = adminDb.collection('system_health').doc(source)
    const doc = await ref.get()
    const wasFailing = doc.exists && (doc.data() as any).status === 'failing'
    await ref.set(
      {
        status: 'ok',
        last_run_at: FieldValue.serverTimestamp(),
        ...(wasFailing ? { recovered_at: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true }
    )
    if (!wasFailing) return
    await sendAlertEmail(
      `✅ [CityBeat] ${source} recovered`,
      `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <p><strong>${esc(source)}</strong> is healthy again as of ${new Date().toISOString()} — the earlier failure alert is resolved.</p>
</div>`
    )
  } catch {
    /* never crash the caller */
  }
}

/** `system_health` doc ids starting with `_` are bookkeeping, not job sources. */
const LIVENESS_REGISTRY_DOC = '_tracking'

function toMillis(value: any): number | null {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value === 'string') return Date.parse(value) || null
  return null
}

/**
 * Every job's last recorded run, plus when liveness recording itself started.
 *
 * `tracking_since` is what stops the first deploy of this feature from paging
 * about twenty perfectly healthy jobs that simply haven't run yet under the new
 * code — see evaluateCronLiveness. It is created here on first read so no
 * separate migration or bootstrap step can be forgotten.
 *
 * One collection read of ~20 tiny docs; safe to call from a daily cron.
 */
export async function readCronLiveness(options: { createRegistry?: boolean } = {}): Promise<{
  lastRunAtMs: Record<string, number | null>
  trackingSinceMs: number | null
}> {
  const lastRunAtMs: Record<string, number | null> = {}
  let trackingSinceMs: number | null = null
  const snap = await adminDb.collection('system_health').get()
  for (const doc of snap.docs) {
    const data = doc.data() as any
    if (doc.id === LIVENESS_REGISTRY_DOC) {
      trackingSinceMs = toMillis(data?.started_at)
      continue
    }
    if (doc.id.startsWith('_')) continue
    lastRunAtMs[doc.id] = toMillis(data?.last_run_at)
  }
  if (trackingSinceMs === null && options.createRegistry) {
    await adminDb
      .collection('system_health')
      .doc(LIVENESS_REGISTRY_DOC)
      .set({ started_at: FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => null)
  }
  return { lastRunAtMs, trackingSinceMs }
}

// A bogus bearer token is cheap to send and this handler writes to Firestore, so
// cap the work per instance before the limiter itself becomes the amplifier.
const authRejectCheckedAt = new Map<string, number>()
const AUTH_REJECT_LOCAL_COOLDOWN_MS = 15 * 60 * 1000

/**
 * A caller presented an `Authorization: Bearer …` that did NOT match
 * CRON_SECRET. That is the signature of the failure with no other detector:
 * the secret is rotated on the citybeat-web service but not on the Cloud
 * Scheduler jobs, so every cron 401s at its first line — before its try/catch,
 * before any handler code, before anything that could report. Nothing writes
 * system_alerts, nothing flips system_health, and the next weekly digest still
 * says "all healthy". The requests keep ARRIVING, though, which is what this
 * turns into a signal.
 *
 * Deliberately narrow, because these endpoints are public:
 *   • a request with no bearer at all is an internet scanner — ignored entirely,
 *     so a probe cannot make us write to Firestore;
 *   • one alert per source per 6h, behind a per-instance cooldown so a flood
 *     can't turn the rate limiter into the cost it was meant to prevent;
 *   • skipHealth, because nothing ever calls reportSuccess for a rejected auth,
 *     so flagging the source would pin it to failing forever and devalue the
 *     recovered-state signal for real runs (same reason bug:client skips it).
 */
export async function reportCronAuthRejected(source: string, authorizationHeader: string | null) {
  if (!authorizationHeader || !/^Bearer\s+\S/i.test(authorizationHeader)) {
    return { alerted: false, deduped: true }
  }
  const now = Date.now()
  const checkedAt = authRejectCheckedAt.get(source) || 0
  if (now - checkedAt < AUTH_REJECT_LOCAL_COOLDOWN_MS) return { alerted: false, deduped: true }
  authRejectCheckedAt.set(source, now)

  const rl = await checkRateLimit(`cron-auth-rejected:${source}`, { max: 1, windowMs: 6 * 60 * 60 * 1000 })
  if (!rl.ok) return { alerted: false, deduped: true }

  return reportFailure(
    source,
    new Error(
      'scheduled call rejected: the caller presented a bearer token that does not match CRON_SECRET — the Cloud Scheduler job and the Cloud Run service are out of sync'
    ),
    { reason: 'cron_auth_rejected' },
    { skipHealth: true, alertKey: 'cron-auth', escalate: true }
  )
}

export async function reportFailure(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
  opts?: {
    /**
     * Skip the system_health "failing" flag. Bug reports use this: nothing ever
     * calls reportSuccess('bug:client'), so flagging it would pin that source to
     * failing forever and devalue the recovered-state signal for real crons.
     */
    skipHealth?: boolean
    /** Override the email dedupe bucket (e.g. to keep critical from being crowded out). */
    alertKey?: string
    /**
     * Also text ALERT_SMS_TO. For the failures that mean the business has
     * stopped (money not arriving, the scheduler no longer reaching us) email
     * alone is too weak a channel — it is the one thing an unreachable operator
     * is not looking at.
     */
    escalate?: boolean
  }
) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack || '').slice(0, 2000) : null

  // Put it in the logs FIRST, before anything that can itself fail.
  //
  // Every cron catches its own errors and calls this — and not one of the 17 of
  // them logged anything, so a failure left Cloud Run showing a bare 500 with no
  // reason. The only signal was the alert email, which is fair-weather: it needs
  // Firestore and the mail provider to both be up, which is exactly what may be
  // broken. reconcile-orders — the safety net under the Stripe webhook — failed
  // every scheduled run for two days and the logs said nothing at all about why.
  //
  // One console.error here covers every caller, which is the point of putting it
  // in the shared helper rather than in 17 catch blocks.
  console.error(`[alert:${source}] ${message}`, { context, stack })

  // Mark the source failing so the next success can announce recovery.
  if (!opts?.skipHealth) {
    try {
      await adminDb.collection('system_health').doc(source).set(
        { status: 'failing', last_failure_at: FieldValue.serverTimestamp(), message: message.slice(0, 300) },
        { merge: true }
      )
    } catch {
      /* best effort */
    }
  }

  // Always record the alert, even when the email is deduped away.
  try {
    await adminDb.collection('system_alerts').add({
      source,
      message: message.slice(0, 1000),
      stack,
      context: context || null,
      created_at: FieldValue.serverTimestamp(),
    })
  } catch {
    /* alerting must never crash the caller */
  }

  try {
    const rl = await checkRateLimit(`alert:${opts?.alertKey || source}`, { max: 3, windowMs: 6 * 60 * 60 * 1000 })
    if (!rl.ok) return { alerted: false, deduped: true }

    const subject = `[CityBeat ALERT] ${source} failed`
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat — automation failure</h2>
  <p><strong>Source:</strong> ${esc(source)}</p>
  <p><strong>Error:</strong> ${esc(message.slice(0, 500))}</p>
  ${context ? `<p><strong>Context:</strong> <code>${esc(JSON.stringify(context).slice(0, 500))}</code></p>` : ''}
  <p style="color:#666;font-size:13px">Full details are in the <code>system_alerts</code> Firestore collection.
  Repeat failures from this source are muted for up to 6 hours.</p>
</div>`
    const result = await sendAlertEmail(subject, html)
    if (opts?.escalate) await escalateBySms(`[CityBeat] ${source}: ${message.slice(0, 300)}`)
    return { alerted: result.sent, deduped: false, delivered: result.delivered, recipients: result.recipients }
  } catch {
    return { alerted: false, deduped: false }
  }
}
