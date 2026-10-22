// Whether it is safe to send cold outbound email at volume right now.
//
// WHY THIS EXISTS. The plan was to raise citybeat-ghost-reports from monthly to
// weekly — roughly 300 sends a year to 1,300. Per RECIPIENT nothing changes
// (each listing is still capped at one report per quarter), so the volume itself
// is not the risk. The risk is what those sends land on.
//
// `RESEND_WEBHOOK_SECRET` is not set on the service. /api/webhooks/resend reads
// it first and returns 503 when it is missing, so EVERY email.bounced and
// email.complained event is rejected. Resend retries, gives up, and the address
// never reaches the suppression list. Hard-bounced addresses therefore stay in
// rotation and get mailed again on the next cycle.
//
// Quadrupling cold volume while bounces and spam complaints are being discarded
// is the textbook way to get a sending domain blocked — and the damage lands on
// the domain that also sends payment receipts, claim approvals and lead
// notifications. Losing transactional deliverability to win a growth tactic is a
// bad trade, and an irreversible one on the timescale that matters.
//
// So this is an interlock, not advice: while bounce processing is down, cold
// campaigns stay at their current volume no matter what the scheduler asks for.
// Set the secret and the cap lifts on its own, with no code change.
//
// Transactional mail is deliberately NOT gated. A receipt or a claim approval is
// mail the recipient is expecting and must get; withholding it to protect a
// reputation score would be the wrong priority.

export type DeliverabilityState = {
  /** Can a bounce or complaint actually reach the suppression list? */
  bounceProcessing: boolean
  /** Operator-facing reasons, safe to log. Never contains a secret VALUE. */
  reasons: string[]
}

/**
 * The most a cold campaign may send in one run while bounces are being dropped.
 *
 * Chosen as the current default run size, so this interlock is a CEILING on
 * growth rather than a reduction in what already runs. Making it smaller would
 * punish the existing, working cadence for a problem it is not causing.
 */
export const COLD_SEND_CAP_WITHOUT_BOUNCE_PROCESSING = 25

/** Read deliverability posture from the environment. Pure in its input so it is
 *  testable without touching process.env. */
export function deliverabilityState(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): DeliverabilityState {
  const reasons: string[] = []
  const secret = (env.RESEND_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    reasons.push(
      'RESEND_WEBHOOK_SECRET is unset, so /api/webhooks/resend answers 503 and no bounce or ' +
        'spam complaint can reach the suppression list'
    )
  }
  return { bounceProcessing: reasons.length === 0, reasons }
}

export type SendBudget = {
  /** How many sends this run may actually make. */
  allowed: number
  /** True when the interlock reduced the request. */
  capped: boolean
  /** Empty when nothing was capped. */
  why: string
}

/**
 * How many cold sends a run may make.
 *
 * Never raises a request — a caller asking for fewer than the cap gets what it
 * asked for. This only ever withholds volume.
 */
export function coldSendBudget(
  requested: number,
  state: DeliverabilityState,
  cap: number = COLD_SEND_CAP_WITHOUT_BOUNCE_PROCESSING
): SendBudget {
  const asked = Math.max(0, Math.floor(requested))
  if (state.bounceProcessing || asked <= cap) {
    return { allowed: asked, capped: false, why: '' }
  }
  return {
    allowed: cap,
    capped: true,
    why:
      `Cold send volume held at ${cap} (requested ${asked}) because bounce processing is down: ` +
      state.reasons.join('; '),
  }
}
