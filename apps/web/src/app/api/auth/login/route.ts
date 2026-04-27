import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

type CookieToSet = {
  name: string
  value: string
  options: Record<string, unknown>
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
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.headers
          .get('cookie')
          ?.split(';')
          .map((cookie) => {
            const [name, ...valueParts] = cookie.trim().split('=')
            return { name, value: valueParts.join('=') }
          })
          .filter((cookie) => cookie.name)
          ?? []
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return response
}
