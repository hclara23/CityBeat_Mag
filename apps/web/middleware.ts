import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { locales, defaultLocale } from './src/lib/i18n'

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/account', '/campaigns', '/ads/campaigns', '/ads/orders', '/billing']

// Auth routes that should redirect to dashboard if already logged in
const authRoutes = ['/login', '/signup', '/reset-password', '/update-password']

// Create the i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export default async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/studio')) {
    return NextResponse.next()
  }

  // Apply i18n middleware
  const response = intlMiddleware(request)

  // Get the pathname
  const pathname = request.nextUrl.pathname

  // Extract locale from pathname
  const locale = locales.find(l => pathname.startsWith(`/${l}`)) || defaultLocale

  // Remove locale from pathname for route checking
  const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/'

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    pathWithoutLocale.startsWith(route)
  )

  // Check if route is an auth route
  const isAuthRoute = authRoutes.some(route =>
    pathWithoutLocale.startsWith(route)
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let hasValidSession = false

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    hasValidSession = !!user
  }

  // If accessing protected route without session, redirect to login
  if (isProtectedRoute && !hasValidSession) {
    return NextResponse.redirect(
      new URL(`/${locale}/login`, request.nextUrl.origin)
    )
  }

  // If accessing auth routes with valid session, redirect to dashboard
  if (isAuthRoute && hasValidSession) {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.nextUrl.origin)
    )
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
