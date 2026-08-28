// Customer-facing order lifecycle → a single, plain-language step model. Pure
// so the labels and step ordering stay unit-tested. The customer's order-status
// page renders these; a rep should recognize the same words.

export type OrderStep = {
  key: string
  labelEn: string
  labelEs: string
  state: 'done' | 'current' | 'upcoming'
}

/**
 * Collapse the four internal status fields (payment / intake / fulfillment) a
 * sales order carries into an ordered, human timeline. The four steps are the
 * same for every product; only the wording of "live" differs slightly, so it
 * is kept generic ("published / live").
 */
export function orderStatusSteps(order: {
  payment_status?: unknown
  intake_status?: unknown
  fulfillment_status?: unknown
}): OrderStep[] {
  const paid = order.payment_status === 'paid'
  const briefDone = order.intake_status === 'submitted'
  const fulfillment = String(order.fulfillment_status || '')
  const live = ['fulfilled', 'listing_live', 'published', 'delivered'].includes(fulfillment)
  const inReview = ['in_review', 'provisioning', 'in_progress'].includes(fulfillment)
  const needsAttention = fulfillment === 'needs_attention'

  // Determine the single "current" step: the earliest not-done one.
  const raw: Array<{ key: string; labelEn: string; labelEs: string; done: boolean }> = [
    { key: 'paid', labelEn: 'Payment received', labelEs: 'Pago recibido', done: paid },
    {
      key: 'brief',
      labelEn: 'Your details submitted',
      labelEs: 'Tus datos enviados',
      done: briefDone,
    },
    {
      key: 'review',
      labelEn: 'CityBeat review',
      labelEs: 'Revisión de CityBeat',
      done: live,
    },
    {
      key: 'live',
      labelEn: 'Published & live',
      labelEs: 'Publicado y en línea',
      done: live,
    },
  ]

  let currentAssigned = false
  return raw.map((s) => {
    let state: OrderStep['state']
    if (s.done) state = 'done'
    else if (!currentAssigned) {
      state = 'current'
      currentAssigned = true
    } else state = 'upcoming'
    // Surface a stalled review as the current step even though it's not done.
    if (s.key === 'review' && inReview && !currentAssigned) state = 'current'
    void needsAttention
    return { key: s.key, labelEn: s.labelEn, labelEs: s.labelEs, state }
  })
}

/** A one-line status headline for the customer. */
export function orderStatusHeadline(
  order: { payment_status?: unknown; intake_status?: unknown; fulfillment_status?: unknown },
  locale: 'en' | 'es'
): string {
  const isEs = locale === 'es'
  const fulfillment = String(order.fulfillment_status || '')
  if (order.payment_status !== 'paid') {
    return isEs ? 'Esperando el pago' : 'Waiting for payment'
  }
  if (['fulfilled', 'listing_live', 'published', 'delivered'].includes(fulfillment)) {
    return isEs ? '¡Tu pedido está en línea!' : "You're live!"
  }
  if (fulfillment === 'needs_attention') {
    return isEs ? 'Necesitamos revisar algo — te contactaremos' : "We need to review something — we'll be in touch"
  }
  if (order.intake_status !== 'submitted') {
    return isEs ? 'Completa los detalles de tu pedido' : 'Finish your order details'
  }
  return isEs ? 'En revisión por el equipo de CityBeat' : 'In review by the CityBeat team'
}
