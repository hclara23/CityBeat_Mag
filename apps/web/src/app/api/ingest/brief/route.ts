import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

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

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const contentEN = typeof body.contentEN === 'string' ? body.contentEN : body.content || ''
  const contentES = typeof body.contentES === 'string' ? body.contentES : ''
  const excerpt = (contentEN || '').slice(0, 160)

  try {
    const docRef = await adminDb.collection('articles').add({
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      excerpt,
      content: textToBlocks(contentEN),
      content_es: textToBlocks(contentES),
      category: typeof body.category === 'string' ? body.category : 'news',
      author: typeof body.source === 'string' ? body.source : 'CityBeat Wire',
      status: 'pending_review',
      published_at: null,
      image_url: null,
      origin: 'automation',
      created_at: FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true, id: docRef.id }, { status: 201 })
  } catch (error) {
    console.error('brief ingest error:', error)
    return NextResponse.json({ error: 'Failed to ingest brief' }, { status: 500 })
  }
}
