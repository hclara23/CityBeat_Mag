import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'

// The brand display/body font. Self-hosted by next/font (no network round-trip,
// no layout shift). Space Grotesk ships 300–700 — combined with font-synthesis:none
// in globals.css, font-black (900) renders crisply at the real 700 max, no halo.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CityBeat - Local Magazine',
  description: 'Bilingual local magazine for El Paso County, Horizon, Socorro, Clint, and Las Cruces',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning className={spaceGrotesk.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
