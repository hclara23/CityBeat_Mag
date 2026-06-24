import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { rewriteSourceArticle } from '@/lib/rewrite'

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

  // Avoid republishing copyrighted text: rewrite the source brief into an
  // ORIGINAL draft (own wording) plus a summary. If no LLM key is configured,
  // fall back to a summary-and-link draft (standard low-risk aggregation).
  const rewritten = await rewriteSourceArticle({ title: sourceTitle, sourceText, sourceName, category })

  const attribution = sourceUrl
    ? `Source: ${sourceName} — ${sourceUrl}`
    : `Source: ${sourceName}`

  let title: string
  let excerpt: string
  let bodyText: string
  let needsRewrite = false

  if (rewritten) {
    title = rewritten.title
    excerpt = rewritten.summary || rewritten.bodyText.slice(0, 160)
    bodyText = `${rewritten.bodyText}\n\n${attribution}`
  } else {
    // No rewrite available — store only a short summary + attribution/link.
    needsRewrite = true
    title = sourceTitle
    const summary = (sourceText || '').trim().slice(0, 280)
    excerpt = summary.slice(0, 160)
    bodyText = [
      summary || 'Summary pending editorial rewrite.',
      attribution,
      'DRAFT: rewrite this into an original CityBeat article before publishing.',
    ].join('\n\n')
  }

  try {
    const docRef = await adminDb.collection('articles').add({
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      excerpt,
      content: textToBlocks(bodyText),
      content_es: [],
      category,
      author: sourceName,
      status: 'pending_review',
      published_at: null,
      image_url: null,
      origin: 'automation',
      source_name: sourceName,
      source_url: sourceUrl,
      needs_rewrite: needsRewrite,
      created_at: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true, id: docRef.id, rewritten: Boolean(rewritten) }, { status: 201 })
  } catch (error) {
    console.error('brief ingest error:', error)
    return NextResponse.json({ error: 'Failed to ingest brief' }, { status: 500 })
  }
}
