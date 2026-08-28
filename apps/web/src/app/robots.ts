import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private surfaces + thin/transactional pages that add no search value
        // and would only burn crawl budget or surface as thin results. Most live
        // under a locale prefix (/en/..., /es/...), so the `/*/…` wildcard is
        // required to actually match them; /api/ and /studio are not localized.
        // The marketing page /ads stays crawlable — only its post-purchase
        // /ads/success confirmation is blocked.
        disallow: [
          '/api/', '/studio',
          '/*/admin', '/*/account', '/*/creator', '/*/dashboard', '/*/billing',
          '/*/login', '/*/signup', '/*/reset-password', '/*/update-password',
          '/*/order/', '/*/fulfill/', '/*/checkout', '/*/ads/success',
          // Keep the bare forms too, in case any are reachable without a locale.
          '/admin', '/account', '/creator', '/dashboard', '/billing',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
