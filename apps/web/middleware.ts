import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'

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

  // Check for Firebase session cookie
  // We use a lightweight check here at the Edge. The actual secure verification 
  // happens in the Server Components using firebase-admin.
  const sessionCookie = request.cookies.get('firebase-session')?.value || request.cookies.get('__session')?.value;
  let hasValidSession = !!sessionCookie;

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

  // Inject hreflang Link headers for SEO
  const origin = request.nextUrl.origin
  const linkHeader = locales.map(l => {
    const alternatePath = pathWithoutLocale === '/' ? `/${l}` : `/${l}${pathWithoutLocale}`
    return `<${origin}${alternatePath}>; rel="alternate"; hreflang="${l}"`
  }).join(', ')
  const defaultPath = pathWithoutLocale === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathWithoutLocale}`
  const fullLinkHeader = `${linkHeader}, <${origin}${defaultPath}>; rel="alternate"; hreflang="x-default"`

  response.headers.set('Link', fullLinkHeader)

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
