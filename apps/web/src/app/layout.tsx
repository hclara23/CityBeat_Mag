import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// Root metadata. The `<html>`/`<body>` tags live in `[locale]/layout.tsx` so the
// document `lang` can be driven from the active locale (every /es page must
// declare lang="es" for screen readers and hreflang consistency — WCAG 3.1.1).
// The only route rendered outside `[locale]` is `app/page.tsx`, which just
// redirect()s and emits no markup, so this passthrough root never renders a
// page without html/body.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'CityBeat — El Paso Local News, Events & Business Directory',
  description:
    'Bilingual local news, events, deals, and a business directory for El Paso County, Horizon, Socorro, Clint, and Las Cruces.',
  openGraph: {
    siteName: 'CityBeat',
    type: 'website',
    images: ['/api/og'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
