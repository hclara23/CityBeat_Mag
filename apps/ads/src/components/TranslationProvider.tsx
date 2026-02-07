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

  type TranslationFn = ((key: string) => string) & { raw: (key: string) => any }

  const translate = ((key: string) => {
    const fullKey = ns ? `${ns}.${key}` : key
    return context.t(fullKey)
  }) as TranslationFn

  translate.raw = (key: string) => {
    const fullKey = ns ? `${ns}.${key}` : key
    const keys = fullKey.split('.')
    let current: any = context.messages

    for (const k of keys) {
      current = current?.[k]
    }

    return current ?? key
  }

  return translate
}

export function useLocale() {
  const context = useContext(TranslationContext)
  return context?.locale || 'en'
}
