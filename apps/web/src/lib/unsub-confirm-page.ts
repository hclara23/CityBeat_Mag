// The page an unsubscribe LINK shows. Unsubscribing happens only on POST.
//
// Why: corporate mail scanners (Microsoft Defender, Mimecast, Proofpoint…) fetch
// every link in a message seconds after delivery, with an ordinary desktop
// Chrome user agent. Measured in September 2026: 30 of 34 recorded sales-email
// "clicks" landed within five minutes of sending. When a GET unsubscribed, every
// scanner-guarded recipient was one delivery away from being silently removed
// from every list — without ever seeing the email.
//
// Scanners follow links; they do not submit forms. RFC 8058 one-click
// (List-Unsubscribe-Post) is itself a POST, so the mailbox providers' own
// "Unsubscribe" button still works in one click.

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const shell = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · CityBeat</title></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:20px;margin:0">
<div style="max-width:440px">${body}</div></body></html>`

/** Confirmation form. `action` is the same URL (query string included) so the
 *  POST carries exactly the token the link did. */
export function unsubConfirmPage(action: string, isEs: boolean): string {
  const title = isEs ? '¿Cancelar suscripción?' : 'Unsubscribe?'
  const msg = isEs
    ? 'Confirme que ya no quiere recibir correos de CityBeat.'
    : 'Confirm you no longer want to receive emails from CityBeat.'
  const btn = isEs ? 'Sí, cancelar mi suscripción' : 'Yes, unsubscribe me'
  return shell(
    title,
    `<h1 style="font-weight:800">${title}</h1>
<p style="color:#9ca3af">${msg}</p>
<form method="POST" action="${esc(action)}" style="margin-top:24px">
<button type="submit" style="background:#22d3ee;color:#000;font-weight:800;border:0;padding:12px 22px;border-radius:8px;font-size:15px;cursor:pointer">${btn}</button>
</form>
<p style="margin-top:28px"><a href="https://citybeatmag.co" style="color:#06b6d4">${isEs ? 'Volver a CityBeat →' : 'Back to CityBeat →'}</a></p>`
  )
}

export function unsubResultPage(kind: 'success' | 'invalid' | 'error', isEs: boolean): string {
  const copy = {
    success: isEs
      ? ['Suscripción cancelada', 'Ya no recibirá correos de CityBeat.']
      : ["You're unsubscribed", "You won't receive further CityBeat emails."],
    invalid: isEs
      ? ['Enlace inválido', 'Este enlace para cancelar la suscripción no es válido o expiró.']
      : ['Invalid link', 'This unsubscribe link is invalid or has expired.'],
    error: isEs
      ? ['No se pudo cancelar', 'Ocurrió un error al guardar su preferencia. Intente de nuevo en un momento.']
      : ["Couldn't unsubscribe", 'Something went wrong saving your preference. Please try again in a moment.'],
  }[kind]
  return shell(
    copy[0],
    `<h1 style="font-weight:800;color:${kind === 'success' ? '#fff' : '#f87171'}">${copy[0]}</h1>
<p style="color:#9ca3af">${copy[1]}</p>
<p><a href="https://citybeatmag.co" style="color:#06b6d4">${isEs ? 'Volver a CityBeat →' : 'Back to CityBeat →'}</a></p>`
  )
}
