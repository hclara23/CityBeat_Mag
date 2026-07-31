import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubToken, emailHash, normalizeNewsletterEmail } from '@/lib/newsletter'
import { suppressByHash } from '@/lib/newsletter-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PageKey = 'success' | 'invalid' | 'error'

const COPY: Record<PageKey, { en: [string, string]; es: [string, string]; ok: boolean }> = {
  success: {
    en: ["You're unsubscribed", 'You will no longer receive the CityBeat newsletter.'],
    es: ['Suscripción cancelada', 'Ya no recibirás el boletín de CityBeat.'],
    ok: true,
  },
  invalid: {
    en: ['Invalid link', 'This unsubscribe link is invalid or has expired.'],
    es: ['Enlace inválido', 'Este enlace para cancelar la suscripción no es válido o expiró.'],
    ok: false,
  },
  error: {
    en: ["Couldn't unsubscribe", 'Something went wrong saving your preference. Please try the link again in a moment.'],
    es: ['No se pudo cancelar', 'Ocurrió un error al guardar tu preferencia. Intenta el enlace de nuevo en un momento.'],
    ok: false,
  },
}

function page(key: PageKey, isEs: boolean): NextResponse {
  const c = COPY[key]
  const [title, message] = isEs ? c.es : c.en
  const back = isEs ? 'Volver a CityBeat →' : 'Back to CityBeat →'
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · CityBeat</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:20px">
  <div><h1 style="font-weight:800;color:${c.ok ? '#fff' : '#f87171'}">${title}</h1>
  <p style="color:#9ca3af;max-width:420px">${message}</p>
  <p><a href="https://citybeatmag.co" style="color:#06b6d4">${back}</a></p></div></body></html>`
  return new NextResponse(html, { status: c.ok ? 200 : 500, headers: { 'Content-Type': 'text/html' } })
}

// One-click unsubscribe. New links carry a signed, opaque token (?u=) that never
// exposes the email; legacy ?email= links are still honored for messages already
// in inboxes. Suppression is PERSISTED before we show success.
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const token = params.get('u')
  const legacyEmail = (params.get('email') || '').trim()
  const isEs = params.get('l') === 'es'

  let eid: string | null = token ? verifyUnsubToken(token) : null
  if (!eid && legacyEmail) {
    const normalized = normalizeNewsletterEmail(legacyEmail)
    if (normalized.includes('@')) eid = emailHash(normalized)
  }
  if (!eid) return page('invalid', isEs)

  const persisted = await suppressByHash(eid, 'unsubscribed')
  if (!persisted) return page('error', isEs)
  return page('success', isEs)
}

// Allow a one-click POST (RFC 8058 List-Unsubscribe-Post) as well.
export async function POST(request: NextRequest) {
  return GET(request)
}
