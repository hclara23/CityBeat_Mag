export const locales = ['en', 'es'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'en'

export async function getMessages(locale: string): Promise<Record<string, any>> {
  try {
    return (await import(`./messages/${locale}.json`)).default
  } catch {
    return (await import('./messages/en.json')).default
  }
}
