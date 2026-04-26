import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@citybeat/lib/supabase/server'
import { localArticles } from '@/lib/localArticles'
import { cookies } from 'next/headers'

function getLocalBriefs() {
  return localArticles.map((article) => ({
    _id: article._id,
    slug: article.slug,
    title: article.title,
    content: article.content,
    contentEN: article.contentEN,
    contentES: article.contentES,
    excerpt: article.excerpt,
    category: article.category,
    publishedAt: article.publishedAt,
    source: article.source,
    author: article.author,
    status: article.status,
    image: article.image,
  }))
}

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const localBriefs = getLocalBriefs()
  const cookieStore = readonlyCookieStore(await cookies())
  const supabase = createServerClient(cookieStore)

  try {
    const { data: briefs, error, count } = await supabase
      .from('brief_submissions')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const combinedBriefs = [
      ...localBriefs,
      ...(Array.isArray(briefs) ? briefs : []),
    ]
    const page = combinedBriefs.slice(offset, offset + limit)

    return NextResponse.json({
      data: page,
      total: (count || 0) + localBriefs.length,
      limit,
      offset,
      locale,
    })
  } catch (error) {
    console.error('Error fetching briefs:', error)
    const page = localBriefs.slice(offset, offset + limit)

    return NextResponse.json({
      data: page,
      total: localBriefs.length,
      limit,
      offset,
      locale,
      warning: 'Returned local briefs because remote briefs could not be loaded',
    })
  }
}
