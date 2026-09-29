// Emails for the complimentary-Premium promotion (lib/directory-comp.ts).
// Pure so the copy — and above all the terms — stay unit-tested.
//
// Terms the copy must always state, because a "free" offer that surprises
// someone later is how a goodwill gesture turns into a complaint:
//   - it is free, and no card is asked for
//   - the exact date it ends
//   - that it returns to the free Basic listing on its own — nothing is billed
// Full lead details are a Premium perk that only reaches a CLAIMED listing
// (api/leads/quote), so claiming is the one action the email asks for.

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export type CompEmailInput = {
  businessName: string
  listingUrl: string
  claimUrl: string
  /** ISO end of the free period. */
  until: string
  unsubUrl: string
  postalAddress: string
  locale?: unknown
}

export function formatCompDate(iso: string, locale: 'en' | 'es'): string {
  return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-MX' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Denver',
  })
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${esc(href)}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`

const wrap = (inner: string) =>
  `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">${inner}</div>`

function footer(input: CompEmailInput): string {
  return `<p style="font-size:12px;color:#888;margin-top:28px;border-top:1px solid #eee;padding-top:12px">
    CityBeat Mag · ${esc(input.postalAddress)}<br/>
    <a href="${esc(input.unsubUrl)}" style="color:#888">Unsubscribe / Cancelar suscripción</a></p>`
}

function grantBody(input: CompEmailInput, lang: 'en' | 'es'): string {
  const name = esc(input.businessName)
  const date = esc(formatCompDate(input.until, lang))
  if (lang === 'es') {
    return `<h2 style="font-weight:900;margin:0 0 12px">${name}: 3 meses de Premium, gratis</h2>
    <p>Gracias por leer nuestros correos. Activamos <strong>CityBeat Premium</strong> en la ficha de <strong>${name}</strong> en el directorio de negocios de El Paso — sin costo, <strong>hasta el ${date}</strong>.</p>
    <p><strong>No pedimos tarjeta y no se cobra nada.</strong> Al terminar, su ficha regresa sola al plan Básico gratuito.</p>
    <p><strong>Lo que debe hacer (2 minutos):</strong> reclame su ficha. Es gratis y es lo que le da el control:</p>
    ${button(input.claimUrl, 'Reclamar mi ficha')}
    <p><strong>Con Premium puede:</strong></p>
    <ul style="padding-left:20px;margin:0 0 12px">
      <li>Recibir los <strong>datos completos de cada cliente</strong> que pida una cotización</li>
      <li>Escribir una descripción completa y subir hasta 15 fotos y video</li>
      <li>Agregar sus redes sociales y un enlace para reservar</li>
      <li>Publicar ofertas, promociones y eventos</li>
      <li>Ver cuántas personas vieron su ficha y qué buscaron</li>
    </ul>
    <p><strong>Para aprovecharlo al máximo:</strong> suba 5+ fotos buenas, confirme su horario y publique una oferta — las fichas completas reciben más clics.</p>
    <p>Vea su ficha: <a href="${esc(input.listingUrl)}">${esc(input.listingUrl)}</a></p>`
  }
  return `<h2 style="font-weight:900;margin:0 0 12px">${name}: 3 months of Premium, on us</h2>
    <p>Thanks for reading our emails. We've switched on <strong>CityBeat Premium</strong> for <strong>${name}</strong>'s listing in the El Paso business directory — free, <strong>through ${date}</strong>.</p>
    <p><strong>No card needed and nothing is billed.</strong> When it ends, your listing simply returns to the free Basic plan.</p>
    <p><strong>The one thing to do (2 minutes):</strong> claim your listing. It's free, and it's what puts you in control:</p>
    ${button(input.claimUrl, 'Claim my listing')}
    <p><strong>With Premium you can:</strong></p>
    <ul style="padding-left:20px;margin:0 0 12px">
      <li>Get the <strong>full contact details of every customer</strong> who requests a quote</li>
      <li>Write a full description and add up to 15 photos plus video</li>
      <li>Add your social links and a booking link</li>
      <li>Post offers, specials and events</li>
      <li>See how many people viewed your listing and what they searched for</li>
    </ul>
    <p><strong>To get the most out of it:</strong> add 5+ good photos, confirm your hours, and post one offer — complete listings get more clicks.</p>
    <p>See your listing: <a href="${esc(input.listingUrl)}">${esc(input.listingUrl)}</a></p>`
}

/** The "you've been given 3 months free" email. Spanish-first when the
 *  recipient's locale is Spanish; otherwise English with Spanish below it. */
export function compGrantEmail(input: CompEmailInput): { subject: string; html: string } {
  const es = input.locale === 'es'
  const subject = es
    ? `${input.businessName}: 3 meses de Premium gratis en CityBeat`
    : `${input.businessName}: 3 months of CityBeat Premium, free`
  const parts = es ? [grantBody(input, 'es')] : [grantBody(input, 'en'), '<hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>', grantBody(input, 'es')]
  return { subject, html: wrap(parts.join('') + footer(input)) }
}

function reminderBody(input: CompEmailInput & { upgradeUrl: string }, lang: 'en' | 'es'): string {
  const name = esc(input.businessName)
  const date = esc(formatCompDate(input.until, lang))
  if (lang === 'es') {
    return `<h2 style="font-weight:900;margin:0 0 12px">Su Premium gratis termina el ${date}</h2>
    <p>La ficha de <strong>${name}</strong> regresará sola al plan Básico gratuito el ${date}. No se le cobrará nada.</p>
    <p>Si quiere conservar las fotos, las ofertas y los datos completos de sus clientes, puede seguir con Premium por <strong>$19.99 al mes</strong>, y cancelar cuando quiera.</p>
    ${button(input.upgradeUrl, 'Seguir con Premium')}`
  }
  return `<h2 style="font-weight:900;margin:0 0 12px">Your free Premium ends ${date}</h2>
    <p><strong>${name}</strong>'s listing will return to the free Basic plan on its own on ${date}. You won't be charged anything.</p>
    <p>If you'd like to keep your photos, offers and full customer contact details, you can stay on Premium for <strong>$19.99/month</strong> and cancel any time.</p>
    ${button(input.upgradeUrl, 'Keep Premium')}`
}

export function compReminderEmail(input: CompEmailInput & { upgradeUrl: string }): { subject: string; html: string } {
  const es = input.locale === 'es'
  const subject = es
    ? `Su Premium gratis de CityBeat termina el ${formatCompDate(input.until, 'es')}`
    : `Your free CityBeat Premium ends ${formatCompDate(input.until, 'en')}`
  const parts = es ? [reminderBody(input, 'es')] : [reminderBody(input, 'en'), '<hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>', reminderBody(input, 'es')]
  return { subject, html: wrap(parts.join('') + footer(input)) }
}
