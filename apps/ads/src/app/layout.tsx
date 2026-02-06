import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CityBeat Ads Portal',
  description: 'Advertiser portal for CityBeat Magazine',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
