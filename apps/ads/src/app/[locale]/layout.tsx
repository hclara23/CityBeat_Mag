import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { getMessages, locales } from '@/i18n'
import { TranslationProvider } from '@/components/TranslationProvider'

export const metadata: Metadata = {
  title: 'CityBeat Ads Portal',
  description: 'Advertiser portal for CityBeat Magazine',
}

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

  return (
    <html lang={locale}>
      <body>
        <TranslationProvider locale={locale} messages={messages}>
          {children}
        </TranslationProvider>
      </body>
    </html>
  )
}
