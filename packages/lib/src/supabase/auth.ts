import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Browser Supabase client for client-side auth operations
 * Usage: useEffect(() => { ... }, []) in React components
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  )

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string,
  password: string,
  userData?: {
    fullName: string
    companyName?: string
    phoneNumber?: string
    isAdvertiser?: boolean
  }
) {
  const supabase = createClient()

  // Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: userData?.fullName || '',
        company_name: userData?.companyName || '',
        phone_number: userData?.phoneNumber || '',
        is_advertiser: userData?.isAdvertiser || false,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return {
    user: data.user,
    session: data.session,
    message: 'Check your email for a verification link',
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return {
    user: data.user,
    session: data.session,
  }
}

/**
 * Sign in with magic link (passwordless)
 */
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return {
    message: 'Check your email for a sign-in link',
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string, redirectTo?: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${window.location.origin}/update-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return {
    message: 'Check your email for password reset instructions',
  }
}

/**
 * Update user's password
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Get current user session
 */
export async function getSession() {
  const supabase = createClient()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    return { error: error.message }
  }

  return { session }
}

/**
 * Get current logged-in user
 */
export async function getUser() {
  const supabase = createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return { error: error.message }
  }

  return { user }
}

/**
 * Update user profile information
 */
export async function updateProfile(updates: {
  fullName?: string
  companyName?: string
  phoneNumber?: string
  avatarUrl?: string
  locale?: string
}) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: updates.fullName,
      company_name: updates.companyName,
      phone_number: updates.phoneNumber,
      avatar_url: updates.avatarUrl,
      locale: updates.locale,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { user: data.user }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const supabase = createClient()

  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

/**
 * Check if user email is verified
 */
export async function isEmailVerified(): Promise<boolean> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.email_confirmed_at !== null
}

/**
 * Get user's profile data from profiles table
 */
export async function getUserProfile(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}

/**
 * Create profile for new user (called after signup)
 */
export async function createUserProfile(
  userId: string,
  profileData: {
    email: string
    fullName: string
    companyName?: string
    phoneNumber?: string
    isAdvertiser?: boolean
  }
) {
  const supabase = createClient()

  const { data, error } = await supabase.from('profiles').insert([
    {
      id: userId,
      email: profileData.email,
      full_name: profileData.fullName,
      company_name: profileData.companyName || null,
      phone_number: profileData.phoneNumber || null,
      is_advertiser: profileData.isAdvertiser || false,
    },
  ])

  if (error) {
    return { error: error.message }
  }

  return { profile: data }
}

/**
 * Delete user account and associated data
 */
export async function deleteAccount(userId: string) {
  const supabase = createClient()

  // First delete the profile (auth.users will cascade delete)
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) {
    return { error: profileError.message }
  }

  // Then delete the auth user
  // Note: This requires admin API access, should be done via API route
  // Client-side can only delete from profiles table

  return { success: true }
}
