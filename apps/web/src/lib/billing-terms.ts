// What a customer is told before we start charging them every month.
//
// CityBeat sells auto-renewing subscriptions from $9.99 to $99/month, and until
// now disclosed none of it: the Terms of Service were generic boilerplate with no
// mention of subscriptions, renewal, cancellation or refunds, and no checkout
// screen said the price repeats. That is a compliance gap (the card networks
// require recurring terms and an easy cancellation path to be disclosed before
// purchase) and a practical one — "I didn't know it renewed" is a dispute we
// cannot win without showing what the customer was told.
//
// Kept here, beside the payout policy it mirrors, for the same reason: every
// surface must state the same terms, and the terms must describe what the code
// ACTUALLY does. Each line below is traceable:
//   renewal     — Stripe subscription with interval month|year (lib/pricing.ts)
//   cancel      — /billing opens the Stripe customer portal (/api/customer-portal)
//   whatHappens — handleSubscriptionDeleted drops the listing to `basic` and
//                 clears is_sponsored, at the end of the paid period
//   refunds     — nothing is automatic; a refund is a human decision, and when it
//                 is issued charge.refunded downgrades and reverses commission

export type BillingTermsCopy = {
  renewal: string
  cancel: string
  whatHappens: string
  refunds: string
}

export const BILLING_TERMS_EN: BillingTermsCopy = {
  renewal:
    'This is a subscription. It renews automatically at the same price each billing period until you cancel.',
  cancel: 'Cancel any time from Billing in your dashboard — it takes a couple of clicks, no email required.',
  whatHappens:
    'Cancelling stops future charges. You keep everything you paid for until the end of the period you have already paid, and the listing then returns to the free Basic tier.',
  refunds: 'Need a refund? Email hello@citybeatmag.co and a person will look at it.',
}

export const BILLING_TERMS_ES: BillingTermsCopy = {
  renewal:
    'Esto es una suscripción. Se renueva automáticamente al mismo precio cada periodo de facturación hasta que la canceles.',
  cancel: 'Cancela cuando quieras desde Facturación en tu panel — son dos clics, sin necesidad de escribir un correo.',
  whatHappens:
    'Al cancelar dejamos de cobrarte. Conservas todo lo que pagaste hasta que termine el periodo ya pagado, y después la ficha vuelve al plan Básico gratuito.',
  refunds: '¿Necesitas un reembolso? Escribe a hello@citybeatmag.co y una persona lo revisará.',
}

export function billingTerms(locale: string | undefined): BillingTermsCopy {
  return locale === 'es' ? BILLING_TERMS_ES : BILLING_TERMS_EN
}

/** One line for tight spaces — a cart footer, a plan card. Still says the two
 *  things that must be said: that it repeats, and that stopping it is easy. */
export function billingTermsShort(locale: string | undefined, interval: 'month' | 'year' = 'month'): string {
  if (locale === 'es') {
    return interval === 'year'
      ? 'Se renueva cada año hasta que canceles. Cancela cuando quieras desde Facturación.'
      : 'Se renueva cada mes hasta que canceles. Cancela cuando quieras desde Facturación.'
  }
  return interval === 'year'
    ? 'Renews yearly until you cancel. Cancel any time from Billing.'
    : 'Renews monthly until you cancel. Cancel any time from Billing.'
}
