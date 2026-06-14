import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getServerUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const contentType = searchParams.get('content_type')
  const contentId = searchParams.get('content_id')

  try {
    let query: any = adminDb.collection('user_bookmarks').where('user_id', '==', user.id)
    
    if (contentType) query = query.where('content_type', '==', contentType)
    if (contentId) query = query.where('content_id', '==', contentId)

    const snapshot = await query.get()
    const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))

    return NextResponse.json({ bookmarks: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { content_type, content_id } = await request.json()

    if (!content_type || !content_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const newBookmark = {
      user_id: user.id,
      content_type,
      content_id,
      created_at: new Date().toISOString()
    }

    const docRef = await adminDb.collection('user_bookmarks').add(newBookmark)

    return NextResponse.json({ bookmark: { id: docRef.id, ...newBookmark } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getServerUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { content_type, content_id } = await request.json()

    if (!content_type || !content_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const snapshot = await adminDb.collection('user_bookmarks')
      .where('user_id', '==', user.id)
      .where('content_type', '==', content_type)
      .where('content_id', '==', content_id)
      .get()

    if (!snapshot.empty) {
      const batch = adminDb.batch()
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      await batch.commit()
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
