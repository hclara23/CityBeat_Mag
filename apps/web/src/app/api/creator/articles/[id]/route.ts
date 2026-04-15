import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser } from '@citybeat/lib/supabase/server'
import { getSanityWriteClient, sanityServerClient } from '@/lib/sanity'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const query = `*[_type == "article" && _id == $id && author == $authorEmail][0] {
    _id, _createdAt, title, slug, author, excerpt, category, tags, status, publishedAt,
    "imageUrl": image.asset->url,
    "imageAssetId": image.asset._ref,
    body
  }`

  try {
    const article = await sanityServerClient.fetch(query, { id, authorEmail: user.email })
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ article })
  } catch (error) {
    console.error('Error fetching article:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const existing = await sanityServerClient.fetch(
    `*[_type == "article" && _id == $id && author == $authorEmail][0]{ _id, status }`,
    { id, authorEmail: user.email }
  )
  if (!existing) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  if (existing.status === 'published') {
    return NextResponse.json({ error: 'Published articles cannot be edited' }, { status: 403 })
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

  const patch: Record<string, unknown> = {}
  if (title) patch.title = (title as string).trim()
  if (authorName !== undefined) patch.authorName = (authorName as string).trim()
  if (excerpt !== undefined) patch.excerpt = excerpt
  if (bodyText !== undefined) patch.body = toPortableText(bodyText as string)
  if (category !== undefined) patch.category = category
  if (Array.isArray(tags)) patch.tags = tags
  if (submitForReview) patch.status = 'pending_review'
  if (assetId) {
    patch.image = { _type: 'image', asset: { _type: 'reference', _ref: assetId } }
  }

  try {
    const client = getSanityWriteClient()
    const updated = await client.patch(id).set(patch).commit()
    return NextResponse.json({ article: updated })
  } catch (error) {
    console.error('Error updating article:', error)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const existing = await sanityServerClient.fetch(
    `*[_type == "article" && _id == $id && author == $authorEmail][0]{ _id, status }`,
    { id, authorEmail: user.email }
  )
  if (!existing) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  if (existing.status === 'published') {
    return NextResponse.json({ error: 'Published articles cannot be deleted' }, { status: 403 })
  }

  try {
    const client = getSanityWriteClient()
    await client.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting article:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
