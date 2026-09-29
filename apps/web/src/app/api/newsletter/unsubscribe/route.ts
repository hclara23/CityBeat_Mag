import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubToken, emailHash, normalizeNewsletterEmail } from '@/lib/newsletter'
import { suppressByHash } from '@/lib/newsletter-server'
import { unsubConfirmPage, unsubResultPage } from '@/lib/unsub-confirm-page'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Unsubscribe from every CityBeat marketing stream. New links carry a signed,
// opaque token (?u=) that never exposes the email; legacy ?email= links are
// still honored for messages already in inboxes.
//
// GET only CONFIRMS; POST unsubscribes. Mail scanners fetch every link on
// delivery, so a GET that acted would unsubscribe recipients who never saw the
// email (see lib/unsub-confirm-page.ts). RFC 8058 one-click is a POST, so the
// mailbox providers' own Unsubscribe button still works in one step.

function resolve(request: NextRequest): { eid: string | null; isEs: boolean } {
  const params = new URL(request.url).searchParams
  const token = params.get('u')
  const legacyEmail = (params.get('email') || '').trim()
  let eid: string | null = token ? verifyUnsubToken(token) : null
  if (!eid && legacyEmail) {
    const normalized = normalizeNewsletterEmail(legacyEmail)
    if (normalized.includes('@')) eid = emailHash(normalized)
  }
  return { eid, isEs: params.get('l') === 'es' }
}

const html = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(request: NextRequest) {
  const { eid, isEs } = resolve(request)
  // A bad link is the caller's problem, not a server fault — 400, not 500, so
  // mangled links stop reading as outages in the error log.
  if (!eid) return html(unsubResultPage('invalid', isEs), 400)
  const url = new URL(request.url)
  return html(unsubConfirmPage(`${url.pathname}${url.search}`, isEs), 200)
}

export async function POST(request: NextRequest) {
  const { eid, isEs } = resolve(request)
  if (!eid) return html(unsubResultPage('invalid', isEs), 400)
  // Suppression is PERSISTED before we show success.
  const persisted = await suppressByHash(eid, 'unsubscribed')
  return persisted ? html(unsubResultPage('success', isEs), 200) : html(unsubResultPage('error', isEs), 500)
}
