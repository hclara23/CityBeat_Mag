import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminAuth } from '@citybeat/lib/firebase/admin'

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
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  try {
    await adminAuth.updateUser(user.id, { password })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Update password error:', error)
    return NextResponse.json({ error: error?.message || 'Could not update password' }, { status: 500 })
  }
}
