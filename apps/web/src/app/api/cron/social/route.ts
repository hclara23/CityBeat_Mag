import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPublishedArticles } from '@/lib/articles'
import { postArticleToSocial, socialConfigured } from '@/lib/social'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Auto-posts recently published articles to configured social networks. No-ops
// (returns configured:false) until FB/IG/X credentials are set. Dedupes per
// article via the `social_posts` collection.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!socialConfigured()) return NextResponse.json({ ok: true, configured: false, skipped: 'no_social_credentials' })

  const { searchParams } = new URL(request.url)
  const max = Math.min(Number(searchParams.get('limit')) || 5, 20)

  const all = await getPublishedArticles().catch(() => [])
  const recent = all
    .filter((a: any) => {
      const t = Date.parse(a.publishedAt)
      return Number.isNaN(t) || t >= Date.now() - 3 * 86400000 // last 3 days
    })
    .sort((a: any, b: any) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, max)

  try {
    let posted = 0
    const results: any[] = []
    for (const a of recent) {
      const already = await adminDb.collection('social_posts').where('slug', '==', a.slug).limit(1).get()
      if (!already.empty) continue
      const r = await postArticleToSocial(a)
      const didPost = r.some((x) => x.status === 'posted')
      await adminDb.collection('social_posts').add({
        slug: a.slug,
        title: a.title,
        results: r,
        created_at: FieldValue.serverTimestamp(),
      })
      if (didPost) posted++
      results.push({ slug: a.slug, networks: r })
    }

    return NextResponse.json({ ok: true, configured: true, considered: recent.length, posted, results })
  } catch (error) {
    await reportFailure('cron:social', error)
    return NextResponse.json({ error: 'Social run failed' }, { status: 500 })
  }
}
