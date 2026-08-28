// Shared SEO helpers so every public route emits consistent, server-rendered
// canonical + hreflang and structured data. This is the single source of truth
// for the alternates block that replaced the (invalid, in-<body>) client
// HreflangTags component.

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export type Loc = 'en' | 'es'

export function normLocale(locale: string | undefined): Loc {
  return locale === 'es' ? 'es' : 'en'
}

/**
 * Self-referencing canonical + en/es/x-default hreflang for a locale-agnostic
 * path (e.g. '/directory', '/stories/foo'). Pass the path WITHOUT the locale
 * prefix and WITHOUT query string so filtered/paginated variants consolidate to
 * the base URL. x-default points at the English URL.
 */
export function localeAlternates(locale: string, path: string) {
  const loc = normLocale(locale)
  const clean = '/' + String(path || '').replace(/^\/+/, '').replace(/\/+$/, '')
  const p = clean === '/' ? '' : clean
  const en = `${SITE_URL}/en${p}`
  const es = `${SITE_URL}/es${p}`
  return {
    canonical: `${SITE_URL}/${loc}${p}`,
    languages: { en, es, 'x-default': en },
  }
}

/**
 * BreadcrumbList JSON-LD. `trail` is ordered root→leaf; each item's `path` is
 * locale-agnostic (the locale is prepended here). The final item may omit
 * `path` (the current page needs no item URL).
 */
export function breadcrumbJsonLd(
  locale: string,
  trail: Array<{ name: string; path?: string }>
) {
  const loc = normLocale(locale)
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.path
        ? { item: `${SITE_URL}/${loc}${item.path.startsWith('/') ? '' : '/'}${item.path}` }
        : {}),
    })),
  }
}
