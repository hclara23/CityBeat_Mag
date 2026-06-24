import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const eventsSnap = await adminDb.collection('events').orderBy('start_date', 'asc').get()
    const events = eventsSnap.docs.map((d) => ({ 
      id: d.id, 
      ...(d.data() as any), 
      created_at: toIso((d.data() as any).created_at) 
    }))

    return NextResponse.json({ events })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Event ID required' }, { status: 400 })

  try {
    await adminDb.collection('events').doc(id).delete()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
