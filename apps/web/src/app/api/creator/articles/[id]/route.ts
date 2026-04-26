import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, createServerClient } from '@citybeat/lib/supabase/server'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
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
  const supabase = createServerClient(cookieStore)

  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('author_id', user.id)
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
      category: article.category_id,
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
  const supabase = createServerClient(cookieStore)

  // Verify ownership and status
  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('status, author_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing || existing.author_id !== user.id) {
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

  const { title, excerpt, content, bodyText, category, tags, assetId, submitForReview } = body as {
    title?: string
    excerpt?: string
    content?: any
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string
    submitForReview?: boolean
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  }
  if (title) updateData.title = title.trim()
  if (excerpt !== undefined) updateData.excerpt = excerpt
  if (content !== undefined) updateData.content = content
  else if (bodyText !== undefined) updateData.content = textToContent(bodyText)
  if (category !== undefined) updateData.category_id = category || null
  if (submitForReview) {
    updateData.status = 'pending_review'
    updateData.published_at = new Date().toISOString()
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
  const supabase = createServerClient(cookieStore)

  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('status, author_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing || existing.author_id !== user.id) {
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
