import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return new Proxy({} as any, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          return () => ({ data: null, error: null })
        }
        return null
      }
    })
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey
  )
}
