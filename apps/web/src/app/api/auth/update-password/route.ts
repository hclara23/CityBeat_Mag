import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminAuth } from '@citybeat/lib/firebase/admin'
import { validatePassword, isPasswordBreached } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const pwCheck = validatePassword(password)
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 })
  }
  if (await isPasswordBreached(password)) {
    return NextResponse.json(
      { error: 'This password has appeared in a known data breach. Please choose a different one.' },
      { status: 400 }
    )
  }

  try {
    await adminAuth.updateUser(user.id, { password })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update password error:', error)
    return NextResponse.json({ error: error?.message || 'Could not update password' }, { status: 500 })
  }
}
