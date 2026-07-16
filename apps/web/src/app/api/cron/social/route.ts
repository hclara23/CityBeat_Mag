import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPublishedArticles } from '@/lib/articles'
import { postArticleToSocial, postThisWeekendToSocial, socialConfigured } from '@/lib/social'
import { getThisWeekendEvents } from '@/lib/events'
import { reportFailure, reportSuccess } from '@/lib/alerts'

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

    // Weekly "This Weekend in El Paso" roundup — once per week (Thursdays, or
    // ?weekend=1 to force), deduped by ISO-week key so a daily cron can't repost.
    let weekend: any = null
    const dow = new Date().getUTCDay() // 0 Sun .. 4 Thu
    const forceWeekend = searchParams.get('weekend') === '1'
    if (dow === 4 || forceWeekend) {
      const now = new Date()
      const weekKey = `weekend-${now.getUTCFullYear()}-w${Math.ceil((((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)}`
      const seen = await adminDb.collection('social_posts').where('slug', '==', weekKey).limit(1).get()
      if (seen.empty || forceWeekend) {
        const { events, label } = await getThisWeekendEvents()
        if (events.length > 0) {
          const r = await postThisWeekendToSocial(events as any, label)
          const didPost = r.some((x) => x.status === 'posted')
          // Only mark the week done once something actually posted — a bad token
          // shouldn't silently burn the weekly slot, and a forced retry can work.
          if (didPost) {
            await adminDb.collection('social_posts').add({ slug: weekKey, title: `This Weekend (${label})`, results: r, created_at: FieldValue.serverTimestamp() })
          }
          weekend = { posted: didPost, events: events.length, networks: r }
        } else {
          weekend = { skipped: 'no_weekend_events' }
        }
      } else {
        weekend = { skipped: 'already_posted_this_week' }
      }
    }

    await reportSuccess('cron:social')
    return NextResponse.json({ ok: true, configured: true, considered: recent.length, posted, weekend, results })
  } catch (error) {
    await reportFailure('cron:social', error)
    return NextResponse.json({ error: 'Social run failed' }, { status: 500 })
  }
}
