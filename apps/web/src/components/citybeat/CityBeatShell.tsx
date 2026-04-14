import { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function CityBeatShell({
  locale = 'en',
  children,
}: {
  locale?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter locale={locale} />
    </div>
  )
}
