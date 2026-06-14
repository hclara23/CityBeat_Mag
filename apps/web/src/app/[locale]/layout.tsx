import { getMessages, locales } from '@/i18n'
import { TranslationProvider } from '@/components/TranslationProvider'
import { HreflangTags } from '@/components/HreflangTags'
import { ReactNode, Suspense } from 'react'
import { draftMode } from 'next/headers'
import dynamic from 'next/dynamic'

const LiveVisualEditing = dynamic(() => import('@/components/sanity/LiveVisualEditing'))

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
      <div className="citybeat-app">
        {children}
        {draftMode().isEnabled && (
          <Suspense>
            <LiveVisualEditing />
          </Suspense>
        )}
      </div>
    </TranslationProvider>
  )
}
