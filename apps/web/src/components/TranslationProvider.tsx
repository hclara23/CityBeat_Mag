'use client'

import { createContext, ReactNode, useContext } from 'react'

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
  return context?.locale || 'en'
}
