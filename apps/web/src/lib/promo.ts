// Promotional offers for abandoned-checkout recovery. Pure (no I/O) so the
// terms, eligibility, and email copy stay unit-tested.
//
// FOUNDERS 3-MONTHS-FREE (operator-defined, 2026-08-28): the prospect pays the
// first month ($9.99) normally, then a Stripe coupon (100% off, repeating for
// exactly 3 months) makes months 2–4 free, and when the coupon lapses Stripe
// automatically resumes charging $9.99/mo from month 5. The coupon is applied
// by the webhook AFTER the first invoice is paid, so the first charge is never
// discounted; cancellation any time inside the free months works normally
// (subscription.deleted downgrades the listing like any other cancel).

export const FOUNDERS_PROMO = {
  id: 'founders_3mo_free',
  couponId: 'founders-3mo-free-100',
  freeMonths: 3,
  // Offer links must outlive a Stripe Checkout session's 24h cap — the email
  // links to OUR redirect route, which mints a fresh session on every click.
  tokenDays: 45,
} as const

/** Which abandoned orders may receive the "3 months free" offer. Any unpaid
 *  DIRECTORY SUBSCRIPTION qualifies — the coupon is 100%-off-repeating(3), so
 *  it works at any monthly price (Founding $9.99, Premium $19.99, Featured
 *  $49), and the email states the actual price rather than a hardcoded $9.99.
 *  One-time products (newsletter sponsorship, jobs, events) are excluded: a
 *  "3 free months" subscription offer makes no sense for them. */
const DIRECTORY_SUBSCRIPTION_PRODUCTS = new Set([
  'directory_founding_monthly',
  'directory_founding_annual',
  'directory_premium_monthly',
  'directory_premium_annual',
  'directory_featured_monthly',
  'directory_sponsored_monthly',
])
export function isFoundersPromoEligible(order: Record<string, unknown>): boolean {
  if (order.payment_status === 'paid') return false
  if (order.billing_type !== 'subscription') return false
  return DIRECTORY_SUBSCRIPTION_PRODUCTS.has(String(order.product_id))
}

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const wrap = (inner: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:540px">${inner}</div>`

/**
 * The Founders offer email. States the full billing terms explicitly — a
 * promo that surprises people with month 5 is a chargeback machine. The offer
 * link goes to CityBeat's own redirect (never a raw Stripe session, which
 * would die in 24 hours). EN/ES stacked when the locale is unknown.
 */
export function foundersOfferEmail(input: {
  businessName?: unknown
  offerUrl: string
  locale?: unknown
  // The order's real monthly price label, e.g. "$9.99 / mo". Falls back to the
  // Founding price. Interval label kept generic ("month") since all current
  // eligible plans are monthly; annual plans would need "year".
  priceLabel?: unknown
}): { subject: string; html: string } {
  const business = String(input.businessName || '').trim()
  const url = esc(input.offerUrl)
  const locale = input.locale === 'es' ? 'es' : input.locale === 'en' ? 'en' : 'both'
  // Show the plan's ACTUAL price — this offer now covers Premium ($19.99) and
  // Featured ($49) prospects too, so a hardcoded $9.99 would misstate the deal.
  const price = esc(String(input.priceLabel || '$9.99 / mo').trim())

  const en = `<p>Hi,</p>
<p>A little while ago we set up a CityBeat directory listing${business ? ` for <strong>${esc(business)}</strong>` : ''} and the payment link expired before it was completed. We'd love to have you on board — so here's a better deal than the one you saw:</p>
<p style="font-size:17px;font-weight:700;margin:14px 0 6px">Pay for your first month — get months 2, 3 and 4 FREE.</p>
<p style="font-size:13px;color:#555;margin:0 0 14px">You pay ${price} today, then nothing for three months, then ${price} starting month 5. Cancel anytime.</p>
<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#00e0d1;color:#04121a;padding:13px 22px;text-decoration:none;font-weight:800">Claim the offer</a></p>
<p>Questions? Just reply to this email.</p>
<p style="margin-top:20px">— CityBeat El Paso</p>`
  const es = `<p>Hola,</p>
<p>Hace poco preparamos una ficha de CityBeat${business ? ` para <strong>${esc(business)}</strong>` : ''} y el enlace de pago venció antes de completarse. Nos encantaría tenerte con nosotros — así que aquí va una oferta mejor que la que viste:</p>
<p style="font-size:17px;font-weight:700;margin:14px 0 6px">Paga tu primer mes — y llévate los meses 2, 3 y 4 GRATIS.</p>
<p style="font-size:13px;color:#555;margin:0 0 14px">Pagas ${price} hoy, luego nada durante tres meses, y desde el mes 5 son ${price}. Cancela cuando quieras.</p>
<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#00e0d1;color:#04121a;padding:13px 22px;text-decoration:none;font-weight:800">Aprovechar la oferta</a></p>
<p>¿Preguntas? Responde a este correo.</p>
<p style="margin-top:20px">— CityBeat El Paso</p>`

  const subject =
    locale === 'es'
      ? `3 meses gratis${business ? ` para ${business}` : ''} — oferta de CityBeat`
      : locale === 'en'
        ? `3 months free${business ? ` for ${business}` : ''} — CityBeat offer`
        : `3 months free / 3 meses gratis${business ? ` — ${business}` : ''} — CityBeat`

  const html = wrap(
    locale === 'es' ? es : locale === 'en' ? en : `${en}<hr style="border:none;border-top:1px solid #eee;margin:18px 0">${es}`
  )
  return { subject, html }
}
