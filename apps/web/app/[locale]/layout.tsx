import { redirect } from 'next/navigation'
import { PageTransition } from '@/src/components/motion/PageTransition'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!['en', 'es'].includes(locale)) {
    redirect('/en')
  }

  return <PageTransition>{children}</PageTransition>
}
