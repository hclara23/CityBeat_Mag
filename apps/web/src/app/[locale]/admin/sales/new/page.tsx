import { redirect } from 'next/navigation'

export default function LegacyNewSaleRedirect({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry))
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  redirect(`/${params.locale === 'es' ? 'es' : 'en'}/admin/sales/me${suffix}#new-sale`)
}
