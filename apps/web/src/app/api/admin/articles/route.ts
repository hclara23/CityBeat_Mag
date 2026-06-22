import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  const profile = user ? await getServerUserProfile(user.id) : null
  if (!user || !(profile?.is_editor || profile?.is_developer)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  try {
    let query: any = adminDb.collection('articles')
    if (status) query = query.where('status', '==', status)
    const snap = await query.get()
    const articles = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))

    // Resolve author names and creator emails.
    const authorsSnap = await adminDb.collection('authors').get()
    const authorMap = new Map<string, string>(
      authorsSnap.docs.map((d) => [d.id, (d.data() as any).name])
    )

    const creatorIds = [...new Set(articles.map((a: any) => a.created_by).filter(Boolean))]
    const creatorMap = new Map<string, any>()
    await Promise.all(
      creatorIds.map(async (cid: any) => {
        const p = await adminDb.collection('profiles').doc(cid).get()
        if (p.exists) creatorMap.set(cid, p.data())
      })
    )

    const transformed = articles
      .map((a: any) => {
        const creator = creatorMap.get(a.created_by)
        return {
          ...a,
          created_at: toIso(a.created_at),
          published_at: toIso(a.published_at),
          author_email: creator?.email ?? null,
          author_name:
            (a.author_id && authorMap.get(a.author_id)) ||
            creator?.full_name ||
            creator?.email ||
            a.author ||
            'CityBeat',
        }
      })
      .sort((x: any, y: any) => (String(y.created_at) > String(x.created_at) ? 1 : -1))

    return NextResponse.json({ articles: transformed })
  } catch (error) {
    console.error('Admin articles error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
