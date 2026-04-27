import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerUser, createServerClient, getServerUserProfile } from '@citybeat/lib/supabase/server'

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

function createWriteClient(cookieStore: ReturnType<typeof readonlyCookieStore>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return createServerClient(cookieStore)
}

function hasCreatorAccess(profile: any) {
  return Boolean(profile?.is_writer || profile?.is_editor || ['admin', 'editor'].includes(profile?.role))
}

async function getCategoryId(supabase: SupabaseClient, slug?: string) {
  const categorySlug = slug || 'news'
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const title = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)
  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      slug: categorySlug,
      name_en: title,
      name_es: title,
    })
    .select('id')
    .single()

  if (error) throw error
  return created.id as string
}

async function getAuthorId(supabase: SupabaseClient, name: string) {
  const authorName = name.trim() || 'CityBeat Staff'
  const { data: existing } = await supabase
    .from('authors')
    .select('id')
    .eq('name', authorName)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabase
    .from('authors')
    .insert({ name: authorName })
    .select('id')
    .single()

  if (error) throw error
  return created.id as string
}

export async function GET(request: NextRequest) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const supabase = createWriteClient(cookieStore)

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
    .eq('created_by', user.id)
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
  const profile = await getServerUserProfile(user.id, cookieStore)
  if (!hasCreatorAccess(profile)) {
    return NextResponse.json({ error: 'Writer access is required' }, { status: 403 })
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
  const supabase = createWriteClient(cookieStore)

  const contentValue = content || (bodyText ? textToContent(bodyText as string) : [])
  const categoryId = await getCategoryId(supabase, category)
  const authorId = await getAuthorId(supabase, typeof body.authorName === 'string' ? body.authorName : user.email ?? '')
  const articleData = {
    title: title.trim(),
    slug: `${slug}-${Date.now().toString(36)}`,
    author_id: authorId,
    created_by: user.id,
    excerpt: excerpt || '',
    content: contentValue,
    category_id: categoryId,
    status: submitForReview ? 'pending_review' : 'draft',
    published_at: null,
    cover_image_path: assetId || null,
    image_url: assetId || null,
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
