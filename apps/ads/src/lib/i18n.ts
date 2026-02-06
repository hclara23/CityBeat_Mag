export const locales = ['en', 'es'] as const
export const defaultLocale = 'en' as const

export type Locale = typeof locales[number]

export async function getLocale(locale?: string): Promise<Locale> {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale
  }
  return defaultLocale
}

export async function getMessages(locale: string) {
  try {
    return (await import(`../messages/${locale}.json`)).default
  } catch (error) {
    return (await import(`../messages/en.json`)).default
  }
}
