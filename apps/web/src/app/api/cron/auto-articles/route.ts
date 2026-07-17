import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { fetchElPasoHeadlines, rewriteAsArticle, findArticleImage, newsroomConfigured, type NewsItem } from '@/lib/newsroom'
import { getPlatformSettings } from '@/lib/platform-settings'
import { reportFailure, reportSuccess } from '@/lib/alerts'
import { notify, NOTIFY_WORKFLOWS } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function keyOf(item: NewsItem) {
  return crypto.createHash('sha1').update(item.title.toLowerCase().trim()).digest('hex').slice(0, 24)
}
function slugify(s: string) {
  const base = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'story'}-${Date.now().toString(36).slice(-4)}`
}

// Illustrative CC stock images suit soft/representative stories, but a generic
// photo on a specific crime/breaking item misleads — so only attach images to
// these categories and skip the hard-news bucket ('news').
const IMAGE_CATEGORIES = new Set(['business', 'events', 'culture'])

// A short, stock-search-friendly image query. Prefer the model's 2-4 word
// suggestion; if it's missing, use a generic term for the category (a full
// headline is far too specific for CC stock search).
function imageQueryFor(w: { image_query?: string; category: string }): string {
  const q = (w.image_query || '').trim()
  if (q) return q
  const byCat: Record<string, string> = {
    news: 'city government building',
    business: 'small business storefront',
    events: 'concert crowd event',
    culture: 'art mural gallery',
  }
  return byCat[w.category] || 'el paso texas'
}

// Autonomous newsroom cron. Pulls fresh El Paso / borderland headlines, has Claude
// re-report each as an original AP-style brief (see lib/newsroom.ts rules), and
// saves them to the `articles` collection. Default status is PENDING_REVIEW, so
// they surface in the /admin review queue for a one-click publish; flip
// settings.newsroom_auto_publish (or pass ?publish=1) to publish straight away.
// Deduped via the `processed_news` collection so nothing repeats.
//
// Params: ?limit=2 (articles to publish), ?publish=1 (force publish),
//         ?dryRun=1 (write nothing, return previews).
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!newsroomConfigured()) {
    return NextResponse.json({ ok: true, configured: false, skipped: 'no_anthropic_key' })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 2, 1), 5)
  const dryRun = searchParams.get('dryRun') === '1'
  const settings = await getPlatformSettings().catch(() => ({ newsroom_auto_publish: false } as any))
  const publish = searchParams.get('publish') === '1' || Boolean((settings as any).newsroom_auto_publish)

  try {
    const headlines = await fetchElPasoHeadlines()
    const created: any[] = []
    const skipped: string[] = []
    let attempts = 0
    const maxAttempts = limit + 6 // bound token spend even if many are unusable

    for (const item of headlines) {
      if (created.length >= limit || attempts >= maxAttempts) break
      const id = keyOf(item)

      // Skip anything we've already handled (published or rejected).
      const seen = await adminDb.collection('processed_news').doc(id).get()
      if (seen.exists) continue
      attempts++

      const written = await rewriteAsArticle(item)
      if (!written) {
        if (!dryRun) {
          await adminDb.collection('processed_news').doc(id).set({
            title: item.title, link: item.link, source: item.source,
            publishable: false, at: FieldValue.serverTimestamp(),
          })
        }
        skipped.push(item.title)
        continue
      }

      if (dryRun) {
        const wantsImg = IMAGE_CATEGORIES.has(written.category)
        const q = imageQueryFor(written)
        const previewImg = wantsImg ? await findArticleImage(q).catch(() => null) : null
        created.push({
          title: written.title,
          category: written.category,
          source: item.source,
          words: written.body_en.trim().split(/\s+/).length,
          image_query: wantsImg ? q : '(skipped — hard news)',
          image: previewImg?.url || null,
          image_credit: previewImg?.credit || null,
          preview: written.body_en,
        })
        continue
      }

      // Legally-safe illustrative image (CC-licensed via Openverse) — only for
      // soft categories; hard news stays imageless so a generic photo can't
      // misrepresent a specific event. Never blocks publishing.
      const img = IMAGE_CATEGORIES.has(written.category)
        ? await findArticleImage(imageQueryFor(written)).catch(() => null)
        : null

      const slug = slugify(written.title)
      const ref = await adminDb.collection('articles').add({
        slug,
        title: written.title,
        title_es: written.title_es,
        excerpt: written.excerpt,
        excerpt_es: written.excerpt_es,
        content: written.body_en,
        content_es: written.body_es,
        category: written.category,
        author: 'CityBeat Newsroom',
        status: publish ? 'published' : 'pending_review',
        source_name: item.source,
        source_url: item.link,
        automated: true,
        image_url: img?.url || null,
        image_credit: img?.credit || null,
        image_credit_url: img?.creditUrl || null,
        image_illustrative: img ? true : false,
        created_at: FieldValue.serverTimestamp(),
        published_at: publish ? FieldValue.serverTimestamp() : null,
      })
      await adminDb.collection('processed_news').doc(id).set({
        title: item.title, link: item.link, source: item.source,
        publishable: true, article_id: ref.id, slug, status: publish ? 'published' : 'pending_review',
        at: FieldValue.serverTimestamp(),
      })
      created.push({ id: ref.id, slug, title: written.title, category: written.category, status: publish ? 'published' : 'pending_review' })
    }

    // Ping editors when fresh drafts land in the review queue (Novu — dormant
    // until NOVU_SECRET_KEY + an "article-review" workflow exist).
    if (!dryRun && !publish && created.length > 0) {
      await notify({
        workflowId: NOTIFY_WORKFLOWS.articleReview,
        to: { subscriberId: 'editors', email: process.env.ALERT_EMAIL },
        payload: { count: created.length },
      })
    }

    await reportSuccess('cron:auto-articles')
    return NextResponse.json({
      ok: true,
      configured: true,
      dryRun,
      publish,
      headlines: headlines.length,
      created: created.length,
      articles: created,
      skipped_thin: skipped.length,
    })
  } catch (error) {
    await reportFailure('cron:auto-articles', error)
    return NextResponse.json({ error: 'Auto-articles run failed' }, { status: 500 })
  }
}
