// Sitewide brand-entity structured data, rendered once per page from the locale
// layout. Two nodes Google looks for at the site root:
//   • Organization — consolidates the brand entity (name, url, logo) for the
//     Knowledge Panel. `sameAs` is intentionally omitted until real, verified
//     social-profile URLs exist (a wrong sameAs is worse than none).
//   • WebSite — enables the sitelinks search box via a SearchAction pointing at
//     the directory search (which reads ?q=, see DirectoryPageClient).
// Server component: emits static <script type="application/ld+json"> in the SSR
// HTML so crawlers read it without executing JS.

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export function SiteJsonLd({ locale = 'en' }: { locale?: string }) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'CityBeat',
    alternateName: 'CityBeat Magazine',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/api/og`,
      width: 1200,
      height: 630,
    },
    description:
      'Bilingual local news, events, and a business directory for El Paso County and Las Cruces.',
    areaServed: 'El Paso County, Texas and Doña Ana County, New Mexico',
  }

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'CityBeat',
    inLanguage: locale === 'es' ? 'es' : 'en',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/${locale}/directory?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  )
}
