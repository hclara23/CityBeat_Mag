// Buyer-facing transactional emails. Pure builders (no I/O) so content and
// escaping stay unit-tested.
//
// Until these existed the Stripe webhook — the only guaranteed post-payment
// code path — sent the buyer NOTHING for any of the 13 products. Stripe's own
// emails cover subscription invoices only, so a one-time buyer (job posting,
// featured event, sponsored story, custom) paid and heard nothing at all, and
// nobody was ever told their item went live or was rejected.
//
// Language: many buyers have no stored locale (self-serve one-time checkouts
// carry none), so when the locale is unknown the email stacks EN then ES —
// El Paso is ~90% Spanish-speaking and guessing English-only is wrong more
// often than it is right.

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const money = (cents: unknown, currency: unknown) => {
  const amount = Math.max(0, Math.round(Number(cents) || 0)) / 100
  const code = String(currency || 'usd').toUpperCase()
  return `$${amount.toFixed(2)}${code === 'USD' ? '' : ` ${code}`}`
}

const wrap = (inner: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:540px">${inner}</div>`

/** Sent from the webhook the moment payment lands, for every product. */
export function purchaseConfirmationEmail(input: {
  productName?: unknown
  businessName?: unknown
  amountTotal?: unknown
  currency?: unknown
  locale?: unknown
}): { subject: string; html: string } {
  const product = String(input.productName || 'your CityBeat order').trim()
  const business = String(input.businessName || '').trim()
  const price = money(input.amountTotal, input.currency)
  const locale = input.locale === 'es' ? 'es' : input.locale === 'en' ? 'en' : 'both'

  const en = `<p>Hi,</p>
<p>We received your payment of <strong>${esc(price)}</strong> for <strong>${esc(product)}</strong>${business ? ` (${esc(business)})` : ''}. Thank you!</p>
<p>Our team reviews every paid item before it goes live, and we will let you know the moment it does. If we sent you a link to finish your order details, completing it is the fastest way to get published.</p>
<p>Questions? Just reply to this email.</p>
<p style="margin-top:20px">— CityBeat El Paso</p>`
  const es = `<p>Hola,</p>
<p>Recibimos tu pago de <strong>${esc(price)}</strong> por <strong>${esc(product)}</strong>${business ? ` (${esc(business)})` : ''}. ¡Gracias!</p>
<p>Nuestro equipo revisa cada compra antes de publicarla y te avisaremos en cuanto esté en línea. Si te enviamos un enlace para completar los detalles de tu pedido, terminarlo es la forma más rápida de publicar.</p>
<p>¿Preguntas? Responde a este correo.</p>
<p style="margin-top:20px">— CityBeat El Paso</p>`

  const subject =
    locale === 'es'
      ? `Pago recibido — ${product}`
      : locale === 'en'
        ? `Payment received — ${product}`
        : `Payment received / Pago recibido — ${product}`
  const html = wrap(
    locale === 'es' ? es : locale === 'en' ? en : `${en}<hr style="border:none;border-top:1px solid #eee;margin:18px 0">${es}`
  )
  return { subject, html }
}

/** Sent when a human approves or rejects a paid item (job, sponsorship…). */
export function moderationOutcomeEmail(input: {
  itemLabel?: unknown // e.g. the job title or campaign name
  kindLabelEn: string // e.g. "job posting"
  kindLabelEs: string // e.g. "oferta de empleo"
  approved: boolean
  liveUntil?: unknown // ISO date — shown on approval when present
  publicUrl?: unknown // where to see it live
  locale?: unknown
}): { subject: string; html: string } {
  const item = String(input.itemLabel || '').trim()
  const until = typeof input.liveUntil === 'string' && input.liveUntil ? input.liveUntil.slice(0, 10) : ''
  const url = typeof input.publicUrl === 'string' && /^https?:\/\//.test(input.publicUrl) ? input.publicUrl : ''
  const locale = input.locale === 'es' ? 'es' : input.locale === 'en' ? 'en' : 'both'

  const en = input.approved
    ? `<p>Good news — your ${esc(input.kindLabelEn)}${item ? ` “${esc(item)}”` : ''} is now <strong>live</strong>${until ? ` through <strong>${esc(until)}</strong>` : ''}.</p>${url ? `<p><a href="${esc(url)}">See it here</a>.</p>` : ''}<p>Thank you for advertising with CityBeat. Reply to this email if anything looks off.</p>`
    : `<p>We reviewed your ${esc(input.kindLabelEn)}${item ? ` “${esc(item)}”` : ''} and could not publish it as submitted.</p><p>Reply to this email and we will help you fix it — or arrange a refund if you prefer.</p>`
  const es = input.approved
    ? `<p>Buenas noticias: tu ${esc(input.kindLabelEs)}${item ? ` “${esc(item)}”` : ''} ya está <strong>publicada</strong>${until ? ` hasta el <strong>${esc(until)}</strong>` : ''}.</p>${url ? `<p><a href="${esc(url)}">Véla aquí</a>.</p>` : ''}<p>Gracias por anunciarte con CityBeat. Responde a este correo si algo no se ve bien.</p>`
    : `<p>Revisamos tu ${esc(input.kindLabelEs)}${item ? ` “${esc(item)}”` : ''} y no pudimos publicarla tal como se envió.</p><p>Responde a este correo y te ayudamos a corregirla — o gestionamos un reembolso si lo prefieres.</p>`

  const subject = input.approved
    ? locale === 'es'
      ? `Publicada: ${item || input.kindLabelEs}`
      : locale === 'en'
        ? `You're live: ${item || input.kindLabelEn}`
        : `You're live / Publicada: ${item || input.kindLabelEn}`
    : locale === 'es'
      ? `Necesitamos cambios: ${item || input.kindLabelEs}`
      : locale === 'en'
        ? `Changes needed: ${item || input.kindLabelEn}`
        : `Changes needed / Necesitamos cambios: ${item || input.kindLabelEn}`

  const html = wrap(
    locale === 'es' ? es : locale === 'en' ? en : `${en}<hr style="border:none;border-top:1px solid #eee;margin:18px 0">${es}`
  )
  return { subject, html }
}
