import { Space_Grotesk } from 'next/font/google'
import { getMessages, locales } from '@/i18n'
import { TranslationProvider } from '@/components/TranslationProvider'
import { Analytics } from '@/components/Analytics'
import { PostHogProvider } from '@/components/PostHogProvider'
import { SiteJsonLd } from '@/components/SiteJsonLd'
import { ReactNode } from 'react'

// The brand display/body font. Self-hosted by next/font (no network round-trip,
// no layout shift). Space Grotesk ships 300–700 — combined with font-synthesis:none
// in globals.css, font-black (900) renders crisply at the real 700 max, no halo.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

type Props = {
  children: ReactNode
  params: Promise<{
    locale: string
  }>
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  const messages = await getMessages(locale)
  // Drive the document language from the active locale so /es pages announce as
  // Spanish to assistive tech and align with their hreflang="es" (WCAG 3.1.1).
  const lang = locale === 'es' ? 'es' : 'en'

  return (
    <html lang={lang} suppressHydrationWarning className={spaceGrotesk.variable}>
      <body className="antialiased">
        <PostHogProvider phKey={process.env.NEXT_PUBLIC_POSTHOG_KEY} phHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}>
          <TranslationProvider locale={locale} messages={messages}>
            <SiteJsonLd locale={lang} />
            <Analytics />
            <div className="citybeat-app">{children}</div>
          </TranslationProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
