import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './src/lib/i18n'

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/account', '/campaigns', '/billing']

// Auth routes that should redirect to dashboard if already logged in
const authRoutes = ['/login', '/signup', '/reset-password', '/update-password']

// Create the i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export default async function middleware(request: NextRequest) {
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

  // Check if user has valid session by looking at cookies
  const authCookie = request.cookies.get('sb-auth-token')
  const hasValidSession = !!authCookie

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
