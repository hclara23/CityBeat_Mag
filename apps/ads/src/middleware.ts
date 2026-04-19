import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, locales } from './i18n'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))

  if (hasLocale) {
    return NextResponse.next()
  }

  const localizedPathname = pathname === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`
  return NextResponse.redirect(new URL(`${localizedPathname}${search}`, request.url))
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
