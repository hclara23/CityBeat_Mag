import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@citybeat/lib/firebase/admin'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// Re-sends the email-verification link. Always responds the same way regardless
// of whether the account exists or is already verified (no user enumeration).
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`resendverify:ip:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 3600) } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const generic = NextResponse.json({ ok: true, message: 'If that account needs verification, a link is on its way.' })

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic

  try {
    const userRecord = await adminAuth.getUserByEmail(email)
    if (userRecord.emailVerified) return generic // already verified — say nothing specific

    const link = await adminAuth.generateEmailVerificationLink(email, { url: `${APP_URL}/en/login` })
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>Confirm your email address to activate your CityBeat account.</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">Verify my email</a></p>
  <p style="color:#666;font-size:13px;word-break:break-all">${link}</p>
</div>`
    await sendEmail(email, 'Verify your CityBeat email', html)
  } catch {
    /* unknown email — still return generic */
  }

  return generic
}
