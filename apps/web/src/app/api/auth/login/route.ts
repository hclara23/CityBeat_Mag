import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getPrimaryPlatformRole, hasDeveloperAccess, hasSalesAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

function getAuthErrorResponse(message: string) {
  const isNetworkFailure =
    message.toLowerCase().includes('fetch failed') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('enotfound') ||
    message.toLowerCase().includes('eai_again')

  if (isNetworkFailure) {
    return NextResponse.json(
      {
        error:
          'Authentication service is unreachable. Check the Supabase project URL and API keys in Vercel.',
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ error: message }, { status: 401 })
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return response.cookies.get(name)?.value ?? request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set(name, value, options)
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set(name, '', { ...options, maxAge: 0 })
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return getAuthErrorResponse(error.message)
  }

  const user = data.user
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_developer, is_editor, is_writer, is_sales, is_advertiser, sales_dashboard_enabled')
    .eq('id', user.id)
    .single()

  const finalResponse = new NextResponse(
    JSON.stringify({
      ok: true,
      profile: {
        primary_role: getPrimaryPlatformRole(profile),
        is_developer: profile?.is_developer ?? false,
        is_editor: profile?.is_editor ?? false,
        is_writer: profile?.is_writer ?? false,
        is_sales: profile?.is_sales ?? false,
        is_advertiser: profile?.is_advertiser ?? false,
        can_manage_platform: hasDeveloperAccess(profile),
        sales_dashboard_enabled: hasSalesAccess(profile),
      },
    }),
    {
      status: 200,
      headers: response.headers,
    }
  )

  return finalResponse
}
