import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin credentials are not configured.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function requiresAuth(): boolean {
  if (process.env.ADS_REQUIRE_AUTH === 'true') return true
  if (process.env.NODE_ENV === 'production') return true
  return false
}

function createServerSupabaseClient(request: NextRequest) {
  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll() {
          // No-op: API routes do not set cookies here.
        },
      },
    }
  )
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      const demoUserId = process.env.ADS_DEMO_USER_ID
      if (demoUserId) {
        return demoUserId
      }
    }

    if (!supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null
    }

    const supabase = createServerSupabaseClient(request)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      return null
    }

    return data.user.id
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  return data.user.id
}

export async function isAdvertiser(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('profiles')
      .select('is_advertiser')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return false
    }

    return Boolean(data.is_advertiser)
  } catch (error) {
    console.error('Failed to check advertiser role:', error)
    return false
  }
}
