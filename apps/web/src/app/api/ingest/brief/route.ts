import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { rewriteSourceArticle } from '@/lib/rewrite'
import { reportFailure } from '@/lib/alerts'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 96)
}

function textToBlocks(text: string) {
  return (text || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    }))
}

// Ingestion endpoint for the brief-automation worker (Cloudflare).
// The worker POSTs translated briefs here; they land in Firestore `articles`
// as `pending_review` for editors to publish from the admin dashboard.
export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sourceTitle = typeof body.title === 'string' ? body.title.trim() : ''
  if (!sourceTitle) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const sourceText = typeof body.contentEN === 'string' ? body.contentEN : body.content || ''
  const category = typeof body.category === 'string' ? body.category : 'news'
  const sourceName = typeof body.source === 'string' ? body.source : 'CityBeat Wire'
  const sourceUrl = typeof body.url === 'string' ? body.url : null

  try {
    // Dedupe BEFORE spending a Claude call. The worker fetches 5 keywords x 5
    // articles five times a day with no memory, so the same article arrives up
    // to 5x/day — each duplicate cluttered the review queue and emailed the
    // editors again. This check used to run AFTER the rewrite, so a duplicate
    // still paid for a rewrite whose result was then thrown away — and, with
    // the failure path below, would raise an alert about an article we already
    // have. Keyed on the SOURCE url/title: the rewritten headline is model
    // output that differs run to run, so it could never match itself. Same
    // processed_news pattern the auto-articles cron uses.
    const dedupeBasis = (sourceUrl || sourceTitle).toLowerCase().trim()
    const dedupeRef = adminDb
      .collection('processed_news')
      .doc('ingest' + crypto.createHash('sha1').update(dedupeBasis).digest('hex').slice(0, 24))
    if ((await dedupeRef.get()).exists) {
      return NextResponse.json({ ok: true, deduped: true })
    }

    // Avoid republishing copyrighted text: rewrite the source brief into an
    // ORIGINAL draft (own wording) plus a summary.
    const rewritten = await rewriteSourceArticle({ title: sourceTitle, sourceText, sourceName, category })

    if (!rewritten) {
      // There used to be a fallback here that stored the SOURCE's own first 280
      // characters as the article body, appended the internal instruction
      // "DRAFT: rewrite this into an original CityBeat article before
      // publishing", and flagged the document `needs_rewrite: true`. Nothing
      // read that flag — no admin query, no review-page badge, no publish guard
      // — so in /admin the item sat in the same pending_review queue with the
      // same layout as a finished brief, and the review page's publish control
      // is an unconditional status flip. One click published a verbatim excerpt
      // of someone else's article with our own to-do note printed underneath it.
      //
      // This is not a hypothetical branch: lib/rewrite.ts returns null on EVERY
      // failure mode — missing ANTHROPIC_API_KEY, a 429 or 5xx from Anthropic,
      // a timeout, and the LLM spend cap added in 692cda1.
      //
      // No review surface can currently tell an un-rewritten brief from a
      // finished one, so the only safe outcome is no article at all. The dedupe
      // marker is deliberately not written either, so the worker's next
      // scheduled run (five a day) re-ingests this same source once Claude is
      // answering again.
      await reportFailure(
        'ingest:brief',
        new Error('Rewrite unavailable — brief not stored'),
        { title: sourceTitle.slice(0, 160), source: sourceName },
        // Nothing calls reportSuccess for this per-item endpoint, so setting
        // the system_health flag would pin this source to "failing" forever and
        // devalue the recovered-state signal for the crons that do report it.
        { skipHealth: true }
      )
      return NextResponse.json(
        { error: 'Rewrite unavailable; brief not stored', retryable: true },
        { status: 503 }
      )
    }

    const attribution = sourceUrl
      ? `Source: ${sourceName} — ${sourceUrl}`
      : `Source: ${sourceName}`

    const title = rewritten.title
    const excerpt = rewritten.summary || rewritten.bodyText.slice(0, 160)
    const bodyText = `${rewritten.bodyText}\n\n${attribution}`

    const docRef = await adminDb.collection('articles').add({
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      excerpt,
      content: textToBlocks(bodyText),
      content_es: [],
      category,
      // CityBeat's own byline, because CityBeat's own LLM wrote this text.
      // `sourceName` is the outlet the brief was re-reported FROM ('Associated
      // Press', 'El Paso Times', 'KVIA'), and this field is rendered on the
      // story page both as the human-visible byline and as schema.org
      // author @type Person — so bylining it to the outlet published a false
      // authorship claim about a named news organisation, five times a day, on
      // a monetized site. The outlet is credited where credit belongs:
      // source_name/source_url below and the attribution line at the foot of
      // the body. Matches the auto-articles cron, which has always written
      // 'CityBeat Newsroom'.
      author: 'CityBeat Newsroom',
      status: 'pending_review',
      published_at: null,
      image_url: null,
      origin: 'automation',
      source_name: sourceName,
      source_url: sourceUrl,
      created_at: FieldValue.serverTimestamp(),
    })

    await dedupeRef.set({
      source: 'worker_ingest',
      title,
      link: sourceUrl || null,
      article_id: docRef.id,
      at: new Date().toISOString(),
    }).catch(() => {})
    return NextResponse.json({ ok: true, id: docRef.id, rewritten: true }, { status: 201 })
  } catch (error) {
    console.error('brief ingest error:', error)
    return NextResponse.json({ error: 'Failed to ingest brief' }, { status: 500 })
  }
}
