import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getPrimaryPlatformRole, hasDeveloperAccess, hasSalesAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

const AUTH_TIMEOUT_MS = 18000
const PROFILE_TIMEOUT_MS = 8000

class SupabaseTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupabaseTimeoutError'
  }
}

function withTimeout<T>(operation: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new SupabaseTimeoutError(message)), ms)
  })

  return Promise.race([Promise.resolve(operation), timeout]).finally(() => clearTimeout(timeoutId))
}

function getAuthErrorResponse(message: string) {
  const lowerMessage = message.toLowerCase()
  const isNetworkFailure =
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('eai_again') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('522') ||
    lowerMessage.includes('<!doctype') ||
    lowerMessage.includes("unexpected token '<'")

  if (isNetworkFailure) {
    return NextResponse.json(
      {
        error:
          'Authentication service is timing out. Supabase is reachable, but the project database/API is not responding.',
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

  let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>

  try {
    signInResult = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      AUTH_TIMEOUT_MS,
      'Supabase auth timed out'
    )
  } catch (error) {
    return getAuthErrorResponse(error instanceof Error ? error.message : String(error))
  }

  const { data, error } = signInResult

  if (error) {
    return getAuthErrorResponse(error.message)
  }

  const user = data.user
  let profile = null

  try {
    const profileResult = await withTimeout(
      supabase
        .from('profiles')
        .select('role, is_developer, is_editor, is_writer, is_sales, is_advertiser, sales_dashboard_enabled')
        .eq('id', user.id)
        .single(),
      PROFILE_TIMEOUT_MS,
      'Supabase profile lookup timed out'
    )

    profile = profileResult.data
  } catch (error) {
    return getAuthErrorResponse(error instanceof Error ? error.message : String(error))
  }

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
