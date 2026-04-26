import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, createServerClient, isEditor } from '@citybeat/lib/supabase/server'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

export async function GET(request: NextRequest) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  
  if (!user || !(await isEditor(user.id, cookieStore))) {
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
      image_url,
      author:profiles!articles_author_id_fkey(email, full_name)
    `)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  try {
    const { data: articles, error } = await query
    if (error) throw error

    // Transform for response
    const transformedArticles = articles.map((a: any) => ({
      ...a,
      author_email: a.author?.email,
      author_name: a.author?.full_name
    }))

    return NextResponse.json({ articles: transformedArticles })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
