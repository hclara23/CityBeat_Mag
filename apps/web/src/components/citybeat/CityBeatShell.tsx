import { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { ChatWidget } from './ChatWidget'

export function CityBeatShell({
  locale = 'en',
  children,
}: {
  locale?: string
  children: ReactNode
}) {
  const skipLabel = locale === 'es' ? 'Saltar al contenido' : 'Skip to content'
  return (
    <div className="min-h-screen bg-brand-dark text-white">
      {/* Bypass block (WCAG 2.4.1): first focusable element, visually hidden
          until focused, jumps keyboard/switch users past the masthead nav. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-neon focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:uppercase focus:tracking-wider focus:text-black"
      >
        {skipLabel}
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter locale={locale} />
      <ChatWidget />
    </div>
  )
}
