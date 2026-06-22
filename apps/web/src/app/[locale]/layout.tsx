import { getMessages, locales } from '@/i18n'
import { TranslationProvider } from '@/components/TranslationProvider'
import { HreflangTags } from '@/components/HreflangTags'
import { Analytics } from '@/components/Analytics'
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
    <TranslationProvider locale={locale} messages={messages}>
      <HreflangTags />
      <Analytics />
      <div className="citybeat-app">
        {children}
      </div>
    </TranslationProvider>
  )
}
