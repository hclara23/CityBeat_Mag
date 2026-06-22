import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Clears the Firebase session cookie (`__session`, set by /api/auth/login).
export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('__session', '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  })
  return response
}
