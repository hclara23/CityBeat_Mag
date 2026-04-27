import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerUser, createServerClient, isEditor } from '@citybeat/lib/supabase/server'

function readonlyCookieStore(store: Awaited<ReturnType<typeof cookies>>) {
  return { getAll: () => store.getAll(), setAll: () => {} }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  
  if (!user || !(await isEditor(user.id, cookieStore))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { status, rejection_reason } = await request.json()
  const supabase = createServerClient(cookieStore)

  if (!['published', 'rejected', 'draft'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'published') {
    updateData.published_at = new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ article: data })
  } catch (error) {
    console.error('Admin PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = readonlyCookieStore(await cookies())
  const user = await getServerUser(cookieStore)
  
  if (!user || !(await isEditor(user.id, cookieStore))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServerClient(cookieStore)

  try {
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        byline:authors!articles_author_id_fkey(name),
        creator:profiles!articles_created_by_fkey(email, full_name)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({
      article: {
        ...data,
        author: {
          email: data.creator?.email,
          full_name: data.byline?.name || data.creator?.full_name || data.creator?.email,
        },
      },
    })
  } catch (error) {
    console.error('Admin GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
