export const SUPPORTED_LOCALES = ['en', 'es'] as const
export const DEFAULT_LOCALE = 'en' as const

export type Locale = typeof SUPPORTED_LOCALES[number]

export interface TranslationKey {
  [key: string]: string | TranslationKey
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale)
}

export function getLocaleLabel(locale: Locale): string {
  const labels: Record<Locale, string> = {
    en: 'English',
    es: 'Español',
  }
  return labels[locale]
}

export function translateUrl(url: string, fromLocale: Locale, toLocale: Locale): string {
  if (fromLocale === toLocale) return url
  const pattern = new RegExp(`^/(${fromLocale})`)
  return url.replace(pattern, `/${toLocale}`)
}

export function getLocaleFromUrl(pathname: string): Locale {
  const parts = pathname.split('/').filter(Boolean)
  const potential = parts[0]
  return isValidLocale(potential) ? potential : DEFAULT_LOCALE
}
