// Abandoned-checkout recovery (pure logic — no I/O).
//
// A Stripe Checkout Session expires (24h by default), but nothing ever wrote
// that back to the sales_order. Every abandoned order therefore sat at
// `checkout_status: 'ready'` forever, so the Sales Desk showed reps a list of
// live payment links that were all dead — and no one, customer or rep, was ever
// told the link had lapsed.
//
// The live account had 18 checkout sessions and 1 payment: eight real
// businesses received a link, let it expire, and were never followed up with.
// That is the single largest revenue leak found in the audit, so the states
// below are deliberately explicit rather than inferred at each call site.

export type CheckoutLinkState =
  | 'paid'      // money received — terminal, never chase
  | 'completed' // checkout finished (payment may still be settling)
  | 'expired'   // the Stripe session lapsed unpaid — recoverable
  | 'ready'     // link is live and still has time on it
  | 'none'      // no checkout link was ever created (e.g. a free listing)

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The true state of an order's payment link, derived rather than trusted.
 * `checkout_status` alone is unreliable: nothing ever moves it off 'ready'.
 */
export function checkoutLinkState(
  order: Record<string, unknown>,
  now: Date | string = new Date()
): CheckoutLinkState {
  if (order.payment_status === 'paid') return 'paid'
  if (order.checkout_status === 'completed') return 'completed'
  if (!order.checkout_url && !order.stripe_checkout_session_id) return 'none'

  const nowMs = new Date(now).getTime()
  const expiresAt = parseTime(order.checkout_expires_at)
  if (expiresAt !== null) return expiresAt <= nowMs ? 'expired' : 'ready'

  // No stored expiry (older rows): fall back to Stripe's 24h session default,
  // measured from creation. Unknown creation time stays 'ready' rather than
  // guessing an order is dead.
  const createdAt = parseTime(order.created_at)
  if (createdAt === null) return 'ready'
  return createdAt + 24 * 3600 * 1000 <= nowMs ? 'expired' : 'ready'
}

// Don't chase forever: a link that lapsed months ago is a cold lead, not an
// abandoned checkout, and emailing it reads as spam rather than service.
export const RECOVERY_WINDOW_DAYS = 45

/**
 * Should this order get a recovery nudge? One per order, ever — a customer who
 * declined once must not be emailed on every cron run.
 */
export function isRecoverable(
  order: Record<string, unknown>,
  now: Date | string = new Date()
): boolean {
  if (checkoutLinkState(order, now) !== 'expired') return false
  if (order.recovery_emailed_at) return false
  if (typeof order.contact_email !== 'string' || !order.contact_email.includes('@')) return false

  const nowMs = new Date(now).getTime()
  const reference = parseTime(order.checkout_expires_at) ?? parseTime(order.created_at)
  if (reference === null) return false
  return nowMs - reference <= RECOVERY_WINDOW_DAYS * 86400000
}

/** Split a batch into what to mark expired and what to actually email. */
export function planRecovery(
  orders: Array<{ id: string } & Record<string, unknown>>,
  now: Date | string = new Date()
): {
  toExpire: string[]
  toEmail: Array<{ id: string } & Record<string, unknown>>
} {
  const toExpire: string[] = []
  const toEmail: Array<{ id: string } & Record<string, unknown>> = []
  for (const order of orders) {
    if (checkoutLinkState(order, now) !== 'expired') continue
    // Only rewrite rows still claiming to be live, so the marker is idempotent.
    if (order.checkout_status !== 'expired') toExpire.push(order.id)
    if (isRecoverable(order, now)) toEmail.push(order)
  }
  return { toExpire, toEmail }
}

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * The nudge itself. Deliberately short, plain, and written as a person
 * following up — not a marketing blast. It does NOT contain a payment link:
 * the old Stripe session is dead, so linking to it would send the customer to
 * an error page. It invites a reply, which is what a local sales relationship
 * actually runs on.
 */
export function recoveryEmail(input: {
  businessName?: unknown
  productName?: unknown
  locale?: unknown
  replyTo?: unknown
}): { subject: string; html: string } {
  const isEs = input.locale === 'es'
  const business = String(input.businessName || '').trim()
  const product = String(input.productName || '').trim()
  const replyTo = String(input.replyTo || '').trim()

  const subject = isEs
    ? `¿Seguimos adelante con ${business || 'tu ficha'} en CityBeat?`
    : `Still want to move forward with ${business || 'your listing'} on CityBeat?`

  const greeting = isEs ? 'Hola,' : 'Hi,'
  const body = isEs
    ? `Te preparamos un enlace de pago para <strong>${esc(product || 'tu ficha de CityBeat')}</strong>${business ? ` de ${esc(business)}` : ''} y venció antes de completarse. Puede que se te haya pasado — nos pasa a todos.`
    : `We set up a payment link for <strong>${esc(product || 'your CityBeat listing')}</strong>${business ? ` for ${esc(business)}` : ''} and it expired before it was completed. It may have simply slipped by — that happens.`
  const ask = isEs
    ? 'Si todavía te interesa, responde a este correo y te enviamos un enlace nuevo hoy mismo. Si ya no, respóndenos igual y no te volvemos a escribir sobre esto.'
    : 'If you are still interested, just reply to this email and we will send a fresh link today. If not, reply anyway and we will stop bringing it up.'
  const signoff = isEs ? 'Gracias,<br>CityBeat El Paso' : 'Thanks,<br>CityBeat El Paso'

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px">
<p>${greeting}</p>
<p>${body}</p>
<p>${ask}</p>
<p style="margin-top:22px">${signoff}</p>
${replyTo ? `<p style="color:#777;font-size:13px">Reply directly to this message or write to ${esc(replyTo)}.</p>` : ''}
</div>`

  return { subject, html }
}
