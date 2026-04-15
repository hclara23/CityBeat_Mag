import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser } from '@citybeat/lib/supabase/server'
import { getSanityWriteClient, sanityServerClient } from '@/lib/sanity'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 96)
}

function toPortableText(text: string) {
  return text.split('\n\n').filter(Boolean).map((paragraph, i) => ({
    _type: 'block',
    _key: `block-${i}`,
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: `span-${i}`, marks: [], text: paragraph.trim() }],
  }))
}

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll: () => store.getAll(),
    setAll: () => {},
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const statusFilter = status ? `&& status == "${status}"` : ''
  const query = `
    *[_type == "article" && author == $authorEmail ${statusFilter}] | order(_createdAt desc) {
      _id,
      _createdAt,
      title,
      slug,
      author,
      excerpt,
      category,
      tags,
      status,
      publishedAt,
      "imageUrl": image.asset->url,
    }
  `

  try {
    const articles = await sanityServerClient.fetch(query, { authorEmail: user.email })
    return NextResponse.json({ articles })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, authorName, excerpt, bodyText, category, tags, assetId, submitForReview } = body as {
    title?: string
    authorName?: string
    excerpt?: string
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string
    submitForReview?: boolean
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const slug = slugify(title)
  const doc: { _type: string; [key: string]: unknown } = {
    _type: 'article',
    title: title.trim(),
    slug: { _type: 'slug', current: slug },
    author: user.email,
    excerpt: excerpt || '',
    body: bodyText ? toPortableText(bodyText as string) : [],
    category: category || '',
    tags: Array.isArray(tags) ? tags : [],
    status: submitForReview ? 'pending_review' : 'draft',
    publishedAt: new Date().toISOString(),
  }

  if (authorName && typeof authorName === 'string') {
    doc.authorName = authorName.trim()
  }

  if (assetId && typeof assetId === 'string') {
    doc.image = { _type: 'image', asset: { _type: 'reference', _ref: assetId } }
  }

  try {
    const client = getSanityWriteClient()
    const created = await client.create(doc)
    return NextResponse.json({ article: created }, { status: 201 })
  } catch (error) {
    console.error('Error creating article:', error)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
