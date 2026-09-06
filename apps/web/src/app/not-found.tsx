import Link from 'next/link'

// The 404 page — and it has to render a COMPLETE document.
//
// `app/layout.tsx` is a passthrough that returns `children` unchanged: the
// `<html>`/`<body>` tags live in `[locale]/layout.tsx` so the document `lang`
// can follow the active locale. Its comment claimed the only thing rendered
// outside `[locale]` was a redirect that emits no markup — but Next renders the
// root not-found here too, and there was no not-found file. So a 404 came back
// as markup that began with a bare `<meta>`: no doctype, no html element, no
// lang, unstyled. A real person who mistyped a URL got that.
//
// It also has to work for the locale layout's own notFound() on an unknown
// locale, which unwinds past that layout — so no locale context is available
// here. Hence both languages, side by side, rather than guessing.

export const metadata = {
  title: 'Page not found — CityBeat',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0b',
          color: '#fff',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.7rem',
              fontWeight: 900,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#22d3ee',
            }}
          >
            404
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: '2rem', fontWeight: 900, lineHeight: 1.1 }}>
            We couldn&rsquo;t find that page
          </h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.05rem', color: 'rgba(255,255,255,0.6)' }}>
            No encontramos esa página
          </p>
          <p style={{ margin: '1.5rem 0 0', fontSize: '0.9rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.6)' }}>
            The link may be out of date, or the address may have a typo in it.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              El enlace puede haber caducado, o la dirección puede tener un error.
            </span>
          </p>
          <div
            style={{
              marginTop: '2rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/en"
              style={{
                background: '#22d3ee',
                color: '#000',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                fontWeight: 900,
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              CityBeat in English
            </Link>
            <Link
              href="/es"
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                fontWeight: 900,
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              CityBeat en Español
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
