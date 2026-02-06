import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CityBeat - Local Magazine',
  description: 'Bilingual local magazine for El Paso County, Horizon, Socorro, Clint, and Las Cruces',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
