import { redirect } from 'next/navigation'

export default async function ReviewQueueRedirect(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = params.locale === 'es' ? 'es' : 'en'
  redirect(`/${locale}/admin`)
}
