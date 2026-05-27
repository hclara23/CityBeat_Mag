import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

export async function POST(request: Request) {
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
  const requestCookies = request.headers
    .get('cookie')
    ?.split(';')
    .map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=')
      return { name, value: valueParts.join('=') }
    })
    .filter((cookie) => cookie.name)
    ?? []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return requestCookies.find((cookie) => cookie.name === name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set(name, value, options)
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set(name, '', { ...options, maxAge: 0 })
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return getAuthErrorResponse(error.message)
  }

  return response
}
