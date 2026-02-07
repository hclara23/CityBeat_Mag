import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import type { Database } from './database.types'

type CookieStore = {
  getAll(): Array<{ name: string; value: string }>
  setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>): void
}

/**
 * Create a Supabase server client with cookie handling
 * Used in Server Components, API routes, and middleware
 */
export const createServerClient = (cookies: CookieStore) =>
  createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookies.setAll(cookiesToSet)
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware handling
            // cookie setting separately.
          }
        },
      },
    }
  )

/**
 * Get the current authenticated user from the server
 */
export async function getServerUser(
  cookies: CookieStore
) {
  const supabase = createServerClient(cookies)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Get the current session from the server
 */
export async function getServerSession(
  cookies: CookieStore
) {
  const supabase = createServerClient(cookies)

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}

/**
 * Get user profile from the database
 */
export async function getServerUserProfile(
  userId: string,
  cookies: CookieStore
) {
  const supabase = createServerClient(cookies)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return null
  }

  return data
}

/**
 * Check if user is authenticated
 * Returns true if user has valid session
 */
export async function isAuthenticated(
  cookies: CookieStore
): Promise<boolean> {
  const user = await getServerUser(cookies)
  return !!user
}

/**
 * Check if user has advertiser role
 */
export async function isAdvertiser(
  userId: string,
  cookies: CookieStore
): Promise<boolean> {
  const profile = await getServerUserProfile(userId, cookies)
  return profile?.is_advertiser ?? false
}

/**
 * Check if user has editor role
 */
export async function isEditor(
  userId: string,
  cookies: CookieStore
): Promise<boolean> {
  const profile = await getServerUserProfile(userId, cookies)
  return profile?.is_editor ?? false
}

/**
 * Get user's campaigns
 */
export async function getUserCampaigns(
  userId: string,
  cookies: CookieStore
) {
  const supabase = createServerClient(cookies)

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('advertiser_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return []
  }

  return data
}

/**
 * Get user's subscription
 */
export async function getUserSubscription(
  userId: string,
  cookies: CookieStore
) {
  const supabase = createServerClient(cookies)

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('advertiser_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return null
  }

  return data
}

/**
 * Get user's analytics
 */
export async function getUserAnalytics(
  userId: string,
  startDate?: string,
  endDate?: string,
  cookies?: CookieStore
) {
  // This would typically be called from an API route
  // Returns the user's campaign analytics
  return {
    totalCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalRevenue: 0,
  }
}

/**
 * Verify JWT token validity (for API routes)
 */
export async function verifyJWT(
  token: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    // Verify token using supabase
    // This is a simplified version - actual implementation depends on your setup
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: String(error) }
  }
}

/**
 * Extract user ID from request headers
 */
export async function getUserIdFromHeaders(
  headers: Record<string, string>,
  cookies: CookieStore
): Promise<string | null> {
  // Try to get from Authorization header (Bearer token)
  const authHeader = headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { valid } = await verifyJWT(token)
    if (valid) {
      // Extract user ID from token
      // This depends on your JWT structure
      return null // Would be extracted from token
    }
  }

  // Fall back to session cookie
  const user = await getServerUser(cookies)
  return user?.id ?? null
}
