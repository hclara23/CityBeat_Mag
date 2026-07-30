import { redirect } from 'next/navigation'

export default function ReviewQueueRedirect({ params }: { params: { locale: string } }) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  redirect(`/${locale}/admin`)
}
