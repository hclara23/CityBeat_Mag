'use client'

import { usePathname } from 'next/navigation'

export function HreflangTags() {
  const pathname = usePathname()

  if (!pathname) return null

  // Strip the locale prefix to get the generic path
  // e.g., "/en/directory/123" -> "/directory/123"
  // e.g., "/es" -> ""
  const pathWithoutLocale = pathname.replace(/^\/(en|es)/, '')

  const domain = 'https://citybeatmag.co'

  const enUrl = `${domain}/en${pathWithoutLocale}`
  const esUrl = `${domain}/es${pathWithoutLocale}`
  
  // x-default should point to the default language (English)
  const defaultUrl = enUrl

  return (
    <>
      <link rel="alternate" hrefLang="en" href={enUrl} />
      <link rel="alternate" hrefLang="es" href={esUrl} />
      <link rel="alternate" hrefLang="x-default" href={defaultUrl} />
    </>
  )
}
