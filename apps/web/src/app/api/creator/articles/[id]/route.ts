import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerUser, createServerClient, getServerUserProfile } from '@citybeat/lib/supabase/server'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
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

function hasEditorAccess(profile: any) {
  return Boolean(profile?.is_editor || ['admin', 'editor'].includes(profile?.role))
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

function textToContent(text: string) {
  return text.split('\n\n').filter(Boolean).map((paragraph, i) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph.trim() }],
  }))
}

function contentToText(content: any): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (block.type === 'paragraph' && Array.isArray(block.content)) {
        return block.content.map((c: any) => c.text || '').join('')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createWriteClient(cookieStore)

  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select(`
        *,
        category:categories!articles_category_id_fkey(slug),
        byline:authors!articles_author_id_fkey(name)
      `)
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    if (error || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Transform for frontend compatibility
    const transformedArticle = {
      ...article,
      _id: article.id,
      _createdAt: article.created_at,
      imageUrl: article.image_url,
      category: article.category?.slug ?? article.category_id,
      authorName: article.byline?.name ?? '',
      content: article.content,
      bodyText: contentToText(article.content),
    }

    return NextResponse.json({ article: transformedArticle })
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
  const profile = await getServerUserProfile(user.id, cookieStore)
  const supabase = createWriteClient(cookieStore)

  // Verify ownership and status
  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('status, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !existing || existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  if (existing.status === 'published' && !hasEditorAccess(profile)) {
    return NextResponse.json({ error: 'Published articles cannot be edited' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, excerpt, content, bodyText, category, tags, assetId, submitForReview, status } = body as {
    title?: string
    excerpt?: string
    content?: any
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string
    submitForReview?: boolean
    status?: 'draft' | 'pending_review' | 'published' | 'rejected' | 'approved'
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  }
  if (title) updateData.title = title.trim()
  if (excerpt !== undefined) updateData.excerpt = excerpt
  if (content !== undefined) updateData.content = content
  else if (bodyText !== undefined) updateData.content = textToContent(bodyText)
  if (category !== undefined) updateData.category_id = category ? await getCategoryId(supabase, category) : null

  if (status) {
    if (!['draft', 'pending_review', 'published', 'rejected', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (status === 'published' && !hasEditorAccess(profile)) {
      return NextResponse.json({ error: 'Editor access is required to publish' }, { status: 403 })
    }
    updateData.status = status
    updateData.published_at = status === 'published' ? new Date().toISOString() : null
  } else if (submitForReview) {
    updateData.status = 'pending_review'
    updateData.published_at = null
  }
  if (assetId !== undefined) updateData.image_url = assetId

  try {
    const { data: updated, error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle tags if provided
    if (Array.isArray(tags)) {
      // Clear existing tags
      await supabase.from('article_tags').delete().eq('article_id', id)
      
      if (tags.length > 0) {
        const tagInserts = tags.map(name => ({ name: name.trim().toLowerCase() }))
        const { data: tagData } = await supabase
          .from('tags')
          .upsert(tagInserts, { onConflict: 'name' })
          .select()

        if (tagData) {
          const articleTagInserts = tagData.map(t => ({
            article_id: id,
            tag_id: t.id
          }))
          await supabase.from('article_tags').insert(articleTagInserts)
        }
      }
    }

    return NextResponse.json({ article: { ...updated, _id: updated.id } })
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
  const supabase = createWriteClient(cookieStore)

  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('status, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !existing || existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  if (existing.status === 'published') {
    return NextResponse.json({ error: 'Published articles cannot be deleted' }, { status: 403 })
  }

  try {
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting article:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
