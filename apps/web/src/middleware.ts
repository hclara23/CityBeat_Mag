import { NextRequest, NextResponse } from 'next/server'
import { contentSecurityPolicy } from './lib/security-policy'

export function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))))
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development')
  const requestHeaders = new Headers(request.headers)
  // Always replace caller-supplied nonce/CSP headers before Next reads them.
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', policy)
  // A per-response nonce must never be shared by a browser or intermediary.
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/((?!api(?:/|$)|_next/|favicon.ico|robots.txt|sitemap.xml|directory/sitemap/|pixel.js|llms.txt|.*\\.(?:png|jpg|jpeg|webp|svg|ico|pdf|woff2?)$).*)'],
}
