import { getMessages, locales } from '@/i18n'
import { TranslationProvider } from '@/components/TranslationProvider'
import { ReactNode } from 'react'

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
