import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, createServerClient } from '@citybeat/lib/supabase/server'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 96)
}

function textToContent(text: string) {
  return text.split('\n\n').filter(Boolean).map((paragraph, i) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph.trim() }],
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
  const supabase = createServerClient(cookieStore)

  let query = supabase
    .from('articles')
    .select(`
      id,
      created_at,
      title,
      slug,
      excerpt,
      category_id,
      status,
      published_at,
      image_url
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  try {
    const { data: articles, error } = await query
    if (error) throw error

    // Transform to match existing frontend expectations if necessary
    const transformedArticles = articles.map(a => ({
      ...a,
      _id: a.id, // Legacy compat
      _createdAt: a.created_at,
      imageUrl: a.image_url,
      category: a.category_id,
    }))

    return NextResponse.json({ articles: transformedArticles })
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

  const { title, excerpt, content, bodyText, category, tags, assetId, submitForReview } = body as {
    title?: string
    excerpt?: string
    content?: any
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string // This is now the URL or path from Supabase Storage
    submitForReview?: boolean
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const slug = slugify(title)
  const supabase = createServerClient(cookieStore)

  const articleData = {
    title: title.trim(),
    slug,
    author_id: user.id,
    excerpt: excerpt || '',
    content: content || (bodyText ? textToContent(bodyText as string) : []),
    category_id: category || null,
    status: submitForReview ? 'pending_review' : 'draft',
    published_at: submitForReview ? new Date().toISOString() : null,
    image_url: assetId || null, // Assuming assetId is the URL for now
  }

  try {
    const { data: created, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select()
      .single()

    if (error) throw error

    // Handle tags if provided
    if (Array.isArray(tags) && tags.length > 0) {
      // 1. Ensure tags exist
      const tagInserts = tags.map(name => ({ name: name.trim().toLowerCase() }))
      const { data: tagData } = await supabase
        .from('tags')
        .upsert(tagInserts, { onConflict: 'name' })
        .select()

      if (tagData) {
        // 2. Link tags to article
        const articleTagInserts = tagData.map(t => ({
          article_id: created.id,
          tag_id: t.id
        }))
        await supabase.from('article_tags').insert(articleTagInserts)
      }
    }

    return NextResponse.json({ article: { ...created, _id: created.id } }, { status: 201 })
  } catch (error) {
    console.error('Error creating article:', error)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
