'use client'

import { createContext, ReactNode, useContext } from 'react'
import { usePathname } from 'next/navigation'

interface TranslationContextType {
  locale: string
  messages: Record<string, any>
  t: (key: string, ns?: string) => string
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: Record<string, any>
  children: ReactNode
}) {
  const t = (key: string, ns?: string) => {
    const keys = key.split('.')
    let current: any = messages

    for (const k of keys) {
      current = current?.[k]
    }

    return current || key
  }

  return (
    <TranslationContext.Provider value={{ locale, messages, t }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslations(ns?: string) {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error('useTranslations must be used within TranslationProvider')
  }

  return (key: string) => {
    const fullKey = ns ? `${ns}.${key}` : key
    return context.t(fullKey)
  }
}

export function useLocale() {
  const context = useContext(TranslationContext)
  // The [locale] layout (and its provider) is preserved across client-side
  // navigation, so context.locale can go stale after a locale switch. The URL
  // is the source of truth — derive the active locale from the pathname and
  // only fall back to the provider value during SSR / when there's no match.
  const pathname = usePathname()
  const fromPath = pathname?.split('/')[1]
  if (fromPath === 'en' || fromPath === 'es') return fromPath
  return context?.locale || 'en'
}
