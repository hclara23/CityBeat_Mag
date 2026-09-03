import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { recordError } from '@/lib/error-reporting-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Client-side crash intake. Before this, a browser exception reached nobody: the
// error boundaries logged to the USER's console and the server never heard about
// it, so a broken checkout button produced zero signal.
//
// This endpoint is necessarily public (a crashing page has no session), so it is
// treated as hostile input: hard per-IP rate limit, strict size caps, a fixed
// field whitelist, and no echo of anything the caller sent. Grouping happens by
// fingerprint server-side, so flooding it inflates one counter rather than
// creating rows.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`telemetry-error:ip:${ip}`, { max: 20, windowMs: 60 * 60 * 1000 })
  // Silently accept when over the limit: a 429 would make a crashing page retry.
  if (!rl.ok) return NextResponse.json({ ok: true })

  try {
    const body = await request.json().catch(() => ({}))
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

    const message = str(body?.message, 500).trim()
    if (!message) return NextResponse.json({ ok: true })

    await recordError({
      source: 'client',
      message,
      stack: str(body?.stack, 4000) || null,
      route: str(body?.route, 200) || null,
      release: str(body?.release, 60) || null,
      userAgent: request.headers.get('user-agent')?.slice(0, 300) || null,
      extra: body?.digest ? { digest: str(body.digest, 80) } : null,
    })
  } catch {
    /* never surface intake failures to a page that is already broken */
  }

  // Always 200: the reporter must never become a second source of errors.
  return NextResponse.json({ ok: true })
}
